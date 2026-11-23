#include "plugin.hpp"
#include "httplib.h"

#include <atomic>
#include <cstdlib>
#include <functional>
#include <future>
#include <memory>
#include <mutex>
#include <queue>
#include <string>
#include <thread>

namespace {

struct PendingCmd {
    std::function<std::string()> fn;
    std::promise<std::string> promise;
};

std::mutex g_cmdMutex;
std::queue<std::shared_ptr<PendingCmd>> g_cmdQueue;
std::atomic<int> g_instanceCount{0};
std::atomic<bool> g_serverRunning{false};
std::unique_ptr<httplib::Server> g_server;
std::thread g_serverThread;
int g_port = 11265;

std::string jsonError(const std::string& msg) {
    json_t* root = json_object();
    json_object_set_new(root, "success", json_false());
    json_object_set_new(root, "error", json_string(msg.c_str()));
    char* s = json_dumps(root, JSON_COMPACT);
    std::string out(s ? s : "{\"success\":false}");
    if (s) free(s);
    json_decref(root);
    return out;
}

std::string dumpAndFree(json_t* root) {
    char* s = json_dumps(root, JSON_COMPACT);
    std::string out(s ? s : "{}");
    if (s) free(s);
    json_decref(root);
    return out;
}

std::string dispatchToUi(std::function<std::string()> fn) {
    auto cmd = std::make_shared<PendingCmd>();
    cmd->fn = std::move(fn);
    auto fut = cmd->promise.get_future();
    {
        std::lock_guard<std::mutex> lock(g_cmdMutex);
        g_cmdQueue.push(cmd);
    }
    if (fut.wait_for(std::chrono::seconds(3)) != std::future_status::ready) {
        return jsonError("Timed out waiting for Rack UI thread");
    }
    return fut.get();
}

void startBridgeServer() {
    if (g_serverRunning.exchange(true)) return;
    if (const char* envPort = std::getenv("VCV_BRIDGE_PORT")) {
        int p = std::atoi(envPort);
        if (p > 0 && p < 65536) g_port = p;
    }

    g_server = std::make_unique<httplib::Server>();

    g_server->Get("/health", [](const httplib::Request&, httplib::Response& res) {
        json_t* root = json_object();
        json_object_set_new(root, "status", json_string("ok"));
        json_object_set_new(root, "service", json_string("vcv-bridge"));
        json_object_set_new(root, "port", json_integer(g_port));
        res.set_content(dumpAndFree(root), "application/json");
    });

    g_server->Get("/state", [](const httplib::Request&, httplib::Response& res) {
        std::string body = dispatchToUi([]() -> std::string {
            if (!APP || !APP->scene || !APP->scene->rack) {
                return jsonError("Rack scene unavailable");
            }
            json_t* root = json_object();
            json_object_set_new(root, "success", json_true());

            json_t* modsJ = json_array();
            for (ModuleWidget* mw : APP->scene->rack->getModules()) {
                if (!mw || !mw->module) continue;
                json_t* mJ = json_object();
                json_object_set_new(mJ, "id", json_integer(mw->module->id));
                if (mw->model) {
                    json_object_set_new(mJ, "model", json_string(mw->model->slug.c_str()));
                    if (mw->model->plugin) {
                        json_object_set_new(mJ, "plugin", json_string(mw->model->plugin->slug.c_str()));
                    }
                }
                json_t* posJ = json_array();
                json_array_append_new(posJ, json_real(mw->box.pos.x));
                json_array_append_new(posJ, json_real(mw->box.pos.y));
                json_object_set_new(mJ, "pos", posJ);

                json_t* paramsJ = json_array();
                int numParams = (int)mw->module->params.size();
                for (int i = 0; i < numParams; ++i) {
                    json_t* pJ = json_object();
                    json_object_set_new(pJ, "id", json_integer(i));
                    json_object_set_new(pJ, "value", json_real(mw->module->params[i].getValue()));
                    if (i < (int)mw->module->paramQuantities.size() && mw->module->paramQuantities[i]) {
                        ParamQuantity* pq = mw->module->paramQuantities[i];
                        json_object_set_new(pJ, "name", json_string(pq->name.c_str()));
                        json_object_set_new(pJ, "min", json_real(pq->minValue));
                        json_object_set_new(pJ, "max", json_real(pq->maxValue));
                    }
                    json_array_append_new(paramsJ, pJ);
                }
                json_object_set_new(mJ, "params", paramsJ);
                json_array_append_new(modsJ, mJ);
            }
            json_object_set_new(root, "modules", modsJ);

            json_t* cablesJ = json_array();
            for (CableWidget* cw : APP->scene->rack->getCables()) {
                if (!cw || !cw->cable) continue;
                json_t* cJ = json_object();
                json_object_set_new(cJ, "id", json_integer(cw->cable->id));
                if (cw->cable->outputModule) {
                    json_object_set_new(cJ, "output_module_id", json_integer(cw->cable->outputModule->id));
                }
                json_object_set_new(cJ, "output_id", json_integer(cw->cable->outputId));
                if (cw->cable->inputModule) {
                    json_object_set_new(cJ, "input_module_id", json_integer(cw->cable->inputModule->id));
                }
                json_object_set_new(cJ, "input_id", json_integer(cw->cable->inputId));
                json_array_append_new(cablesJ, cJ);
            }
            json_object_set_new(root, "cables", cablesJ);
            return dumpAndFree(root);
        });
        res.set_content(body, "application/json");
    });

    g_server->Post("/module/add", [](const httplib::Request& req, httplib::Response& res) {
        json_error_t err;
        json_t* inJ = json_loads(req.body.c_str(), 0, &err);
        if (!inJ) {
            res.set_content(jsonError("Invalid JSON body"), "application/json");
            return;
        }
        const char* pluginSlug = json_string_value(json_object_get(inJ, "plugin"));
        const char* modelSlug = json_string_value(json_object_get(inJ, "model"));
        std::string pStr = pluginSlug ? pluginSlug : "";
        std::string mStr = modelSlug ? modelSlug : "";
        double px = json_number_value(json_object_get(inJ, "x"));
        double py = json_number_value(json_object_get(inJ, "y"));
        json_decref(inJ);

        if (pStr.empty() || mStr.empty()) {
            res.set_content(jsonError("plugin and model are required"), "application/json");
            return;
        }

        std::string body = dispatchToUi([pStr, mStr, px, py]() -> std::string {
            Model* model = plugin::getModel(pStr, mStr);
            if (!model) {
                return jsonError("Model not found: " + pStr + "/" + mStr);
            }
            Module* m = model->createModule();
            ModuleWidget* mw = model->createModuleWidget(m);
            APP->scene->rack->addModule(mw);
            APP->scene->rack->setModulePosNearest(mw, math::Vec((float)px, (float)py));
            json_t* root = json_object();
            json_object_set_new(root, "success", json_true());
            json_object_set_new(root, "module_id", json_integer(mw->module->id));
            json_object_set_new(root, "plugin", json_string(pStr.c_str()));
            json_object_set_new(root, "model", json_string(mStr.c_str()));
            return dumpAndFree(root);
        });
        res.set_content(body, "application/json");
    });

    g_server->Post("/module/remove", [](const httplib::Request& req, httplib::Response& res) {
        json_error_t err;
        json_t* inJ = json_loads(req.body.c_str(), 0, &err);
        if (!inJ) {
            res.set_content(jsonError("Invalid JSON body"), "application/json");
            return;
        }
        int64_t modId = json_integer_value(json_object_get(inJ, "module_id"));
        json_decref(inJ);

        std::string body = dispatchToUi([modId]() -> std::string {
            ModuleWidget* mw = APP->scene->rack->getModule(modId);
            if (!mw) return jsonError("Module not found");
            if (mw->model && mw->model->slug == "VCVBridge") {
                return jsonError("Refusing to remove active VCVBridge module");
            }
            APP->scene->rack->removeModule(mw);
            delete mw;
            json_t* root = json_object();
            json_object_set_new(root, "success", json_true());
            json_object_set_new(root, "removed_module_id", json_integer(modId));
            return dumpAndFree(root);
        });
        res.set_content(body, "application/json");
    });

    g_server->Post("/cable/add", [](const httplib::Request& req, httplib::Response& res) {
        json_error_t err;
        json_t* inJ = json_loads(req.body.c_str(), 0, &err);
        if (!inJ) {
            res.set_content(jsonError("Invalid JSON body"), "application/json");
            return;
        }
        int64_t outModId = json_integer_value(json_object_get(inJ, "output_module_id"));
        int outPortId = (int)json_integer_value(json_object_get(inJ, "output_id"));
        int64_t inModId = json_integer_value(json_object_get(inJ, "input_module_id"));
        int inPortId = (int)json_integer_value(json_object_get(inJ, "input_id"));
        json_decref(inJ);

        std::string body = dispatchToUi([outModId, outPortId, inModId, inPortId]() -> std::string {
            ModuleWidget* outMw = APP->scene->rack->getModule(outModId);
            ModuleWidget* inMw = APP->scene->rack->getModule(inModId);
            if (!outMw || !inMw) return jsonError("Source or destination module not found");
            PortWidget* outPort = outMw->getOutput(outPortId);
            PortWidget* inPort = inMw->getInput(inPortId);
            if (!outPort || !inPort) return jsonError("Output or input port not found");

            CableWidget* cw = new CableWidget();
            cw->color = APP->scene->rack->getNextCableColor();
            cw->setOutput(outPort);
            cw->setInput(inPort);
            cw->updateCable();
            if (!cw->isComplete()) {
                delete cw;
                return jsonError("Failed to connect cable");
            }
            APP->scene->rack->addCable(cw);

            json_t* root = json_object();
            json_object_set_new(root, "success", json_true());
            json_object_set_new(root, "cable_id", json_integer(cw->cable ? cw->cable->id : -1));
            return dumpAndFree(root);
        });
        res.set_content(body, "application/json");
    });

    g_server->Post("/cable/remove", [](const httplib::Request& req, httplib::Response& res) {
        json_error_t err;
        json_t* inJ = json_loads(req.body.c_str(), 0, &err);
        if (!inJ) {
            res.set_content(jsonError("Invalid JSON body"), "application/json");
            return;
        }
        int64_t cableId = json_integer_value(json_object_get(inJ, "cable_id"));
        json_decref(inJ);

        std::string body = dispatchToUi([cableId]() -> std::string {
            CableWidget* cw = APP->scene->rack->getCable(cableId);
            if (!cw) return jsonError("Cable not found");
            APP->scene->rack->removeCable(cw);
            delete cw;
            json_t* root = json_object();
            json_object_set_new(root, "success", json_true());
            json_object_set_new(root, "removed_cable_id", json_integer(cableId));
            return dumpAndFree(root);
        });
        res.set_content(body, "application/json");
    });

    g_server->Post("/param/set", [](const httplib::Request& req, httplib::Response& res) {
        json_error_t err;
        json_t* inJ = json_loads(req.body.c_str(), 0, &err);
        if (!inJ) {
            res.set_content(jsonError("Invalid JSON body"), "application/json");
            return;
        }
        int64_t modId = json_integer_value(json_object_get(inJ, "module_id"));
        int paramId = (int)json_integer_value(json_object_get(inJ, "param_id"));
        float val = (float)json_number_value(json_object_get(inJ, "value"));
        json_decref(inJ);

        std::string body = dispatchToUi([modId, paramId, val]() -> std::string {
            ModuleWidget* mw = APP->scene->rack->getModule(modId);
            if (!mw || !mw->module) return jsonError("Module not found");
            if (paramId < 0 || paramId >= (int)mw->module->params.size()) {
                return jsonError("param_id out of range");
            }
            APP->engine->setParamValue(mw->module, paramId, val);
            json_t* root = json_object();
            json_object_set_new(root, "success", json_true());
            json_object_set_new(root, "module_id", json_integer(modId));
            json_object_set_new(root, "param_id", json_integer(paramId));
            json_object_set_new(root, "value", json_real(val));
            return dumpAndFree(root);
        });
        res.set_content(body, "application/json");
    });

    g_serverThread = std::thread([]() {
        g_server->listen("127.0.0.1", g_port);
    });
}

void stopBridgeServer() {
    if (!g_serverRunning.exchange(false)) return;
    if (g_server) g_server->stop();
    if (g_serverThread.joinable()) g_serverThread.join();
    g_server.reset();
}

} // namespace

struct VCVBridgeModule : Module {
    enum ParamId { PARAMS_LEN };
    enum InputId { INPUTS_LEN };
    enum OutputId { OUTPUTS_LEN };
    enum LightId { LIVE_LIGHT, LIGHTS_LEN };

    VCVBridgeModule() {
        config(PARAMS_LEN, INPUTS_LEN, OUTPUTS_LEN, LIGHTS_LEN);
        if (g_instanceCount.fetch_add(1) == 0) {
            startBridgeServer();
        }
    }

    ~VCVBridgeModule() override {
        if (g_instanceCount.fetch_sub(1) == 1) {
            stopBridgeServer();
        }
    }

    void process(const ProcessArgs& args) override {
        lights[LIVE_LIGHT].setBrightness(g_serverRunning.load() ? 1.f : 0.f);
    }
};

struct VCVBridgeWidget : ModuleWidget {
    VCVBridgeWidget(VCVBridgeModule* module) {
        setModule(module);
        setPanel(createPanel(asset::plugin(pluginInstance, "res/VCVBridge.svg")));
        addChild(createWidget<ScrewSilver>(Vec(RACK_GRID_WIDTH, 0)));
        addChild(createWidget<ScrewSilver>(Vec(box.size.x - 2 * RACK_GRID_WIDTH, 0)));
        addChild(createWidget<ScrewSilver>(Vec(RACK_GRID_WIDTH, RACK_GRID_HEIGHT - RACK_GRID_WIDTH)));
        addChild(createWidget<ScrewSilver>(Vec(box.size.x - 2 * RACK_GRID_WIDTH, RACK_GRID_HEIGHT - RACK_GRID_WIDTH)));
        addChild(createLightCentered<MediumLight<GreenLight>>(mm2px(Vec(15.24, 34.0)), module, VCVBridgeModule::LIVE_LIGHT));
    }

    void step() override {
        ModuleWidget::step();
        std::queue<std::shared_ptr<PendingCmd>> local;
        {
            std::lock_guard<std::mutex> lock(g_cmdMutex);
            std::swap(local, g_cmdQueue);
        }
        while (!local.empty()) {
            auto cmd = local.front();
            local.pop();
            try {
                cmd->promise.set_value(cmd->fn());
            } catch (const std::exception& e) {
                cmd->promise.set_value(jsonError(e.what()));
            } catch (...) {
                cmd->promise.set_value(jsonError("Unknown error in Rack UI command"));
            }
        }
    }
};

Model* modelVCVBridge = createModel<VCVBridgeModule, VCVBridgeWidget>("VCVBridge");
