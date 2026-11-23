RACK_DIR ?= D:/Dev/tools/Rack-SDK

FLAGS += -Isrc -D_WIN32_WINNT=0x0A00
LDFLAGS += -lws2_32

SOURCES += $(wildcard src/*.cpp)
DISTRIBUTABLES += res

include $(RACK_DIR)/plugin.mk
