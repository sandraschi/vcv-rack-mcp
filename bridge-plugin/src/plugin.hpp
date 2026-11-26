#pragma once
#include <rack.hpp>

using namespace rack;

extern Plugin* pluginInstance;
extern Model* modelVCVBridge;

void bridgeStartServer();
void bridgeStopServer();
