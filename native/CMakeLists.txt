cmake_minimum_required(VERSION 3.20)
project(LSearchNative LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(LSearch WIN32
  src/main.cpp
)

target_compile_definitions(LSearch PRIVATE UNICODE _UNICODE)
target_link_libraries(LSearch PRIVATE user32 ole32 shell32 shlwapi)

include(FetchContent)
FetchContent_Declare(
  webview2
  URL https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/1.0.2535.41
  DOWNLOAD_NO_EXTRACT FALSE
)
FetchContent_MakeAvailable(webview2)

target_include_directories(LSearch PRIVATE
  ${webview2_SOURCE_DIR}/build/native/include
)

if(CMAKE_SIZEOF_VOID_P EQUAL 8)
  set(WEBVIEW2_ARCH x64)
else()
  set(WEBVIEW2_ARCH x86)
endif()

target_link_libraries(LSearch PRIVATE
  ${webview2_SOURCE_DIR}/build/native/${WEBVIEW2_ARCH}/WebView2LoaderStatic.lib
)
