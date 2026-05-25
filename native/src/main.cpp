#include <WebView2.h>
#include <wrl.h>
#include <shellapi.h>
#include <windows.h>

#include <string>
#include <vector>

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;

namespace {
constexpr wchar_t kWindowClass[] = L"LSearchWebView";
constexpr wchar_t kDefaultUrl[] = L"https://lsearch.vercel.app/";
constexpr wchar_t kUrlEnvName[] = L"LSEARCH_URL";

ComPtr<ICoreWebView2Controller> controller;
ComPtr<ICoreWebView2> webview;

std::vector<std::wstring> readArgs() {
  int argc = 0;
  LPWSTR* argv = CommandLineToArgvW(GetCommandLineW(), &argc);
  std::vector<std::wstring> args;
  for (int i = 1; argv && i < argc; ++i) {
    args.emplace_back(argv[i]);
  }
  if (argv) {
    LocalFree(argv);
  }
  return args;
}

bool isHttpUrl(const std::wstring& value) {
  return value.rfind(L"http://", 0) == 0 || value.rfind(L"https://", 0) == 0;
}

std::wstring readUrlFromEnvironment() {
  DWORD required = GetEnvironmentVariableW(kUrlEnvName, nullptr, 0);
  if (required == 0) return L"";

  std::wstring value(required, L'\0');
  DWORD written = GetEnvironmentVariableW(kUrlEnvName, value.data(), required);
  if (written == 0) return L"";

  value.resize(written);
  return isHttpUrl(value) ? value : L"";
}

std::wstring readUrl(const std::vector<std::wstring>& args) {
  for (const auto& arg : args) {
    if (isHttpUrl(arg)) return arg;
  }
  std::wstring envUrl = readUrlFromEnvironment();
  return envUrl.empty() ? kDefaultUrl : envUrl;
}

void resizeWebView(HWND hwnd) {
  if (!controller) return;
  RECT bounds;
  GetClientRect(hwnd, &bounds);
  controller->put_Bounds(bounds);
}

LRESULT CALLBACK windowProc(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam) {
  switch (message) {
    case WM_SIZE:
      resizeWebView(hwnd);
      return 0;
    case WM_DESTROY:
      PostQuitMessage(0);
      return 0;
    default:
      return DefWindowProc(hwnd, message, wparam, lparam);
  }
}
}  // namespace

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int showCommand) {
  const std::wstring url = readUrl(readArgs());
  WNDCLASSW windowClass = {};
  windowClass.lpfnWndProc = windowProc;
  windowClass.hInstance = instance;
  windowClass.lpszClassName = kWindowClass;
  windowClass.hCursor = LoadCursor(nullptr, IDC_ARROW);
  RegisterClassW(&windowClass);

  HWND hwnd = CreateWindowExW(
      0,
      kWindowClass,
      L"LSearch",
      WS_OVERLAPPEDWINDOW,
      CW_USEDEFAULT,
      CW_USEDEFAULT,
      1280,
      820,
      nullptr,
      nullptr,
      instance,
      nullptr);

  if (!hwnd) return 1;
  ShowWindow(hwnd, showCommand);

  HRESULT hr = CreateCoreWebView2EnvironmentWithOptions(
      nullptr,
      nullptr,
      nullptr,
      Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
          [hwnd, url](HRESULT result, ICoreWebView2Environment* environment) -> HRESULT {
            if (FAILED(result) || !environment) {
              MessageBoxW(hwnd, L"Impossible d'initialiser WebView2.", L"LSearch", MB_ICONERROR);
              return result;
            }

            environment->CreateCoreWebView2Controller(
                hwnd,
                Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                    [hwnd, url](HRESULT controllerResult, ICoreWebView2Controller* newController) -> HRESULT {
                      if (FAILED(controllerResult) || !newController) {
                        MessageBoxW(hwnd, L"Impossible de creer le controle WebView2.", L"LSearch", MB_ICONERROR);
                        return controllerResult;
                      }

                      controller = newController;
                      controller->get_CoreWebView2(&webview);
                      resizeWebView(hwnd);
                      webview->Navigate(url.c_str());
                      return S_OK;
                    })
                    .Get());
            return S_OK;
          })
          .Get());

  if (FAILED(hr)) {
    MessageBoxW(hwnd, L"WebView2 Runtime est requis.", L"LSearch", MB_ICONERROR);
    return 1;
  }

  MSG message;
  while (GetMessage(&message, nullptr, 0, 0)) {
    TranslateMessage(&message);
    DispatchMessage(&message);
  }

  return 0;
}
