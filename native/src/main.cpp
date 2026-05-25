#include <WebView2.h>
#include <wrl.h>
#include <shellapi.h>
#include <windows.h>
#include <windowsx.h>

#include <string>
#include <vector>

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;

namespace {
constexpr wchar_t kWindowClass[] = L"LSearchWebView";
constexpr wchar_t kDefaultUrl[] = L"https://lsearch.vercel.app/";
constexpr wchar_t kUrlEnvName[] = L"LSEARCH_URL";
constexpr int kResizeBorder = 8;

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

bool isMaximized(HWND hwnd) {
  WINDOWPLACEMENT placement = {};
  placement.length = sizeof(WINDOWPLACEMENT);
  return GetWindowPlacement(hwnd, &placement) && placement.showCmd == SW_SHOWMAXIMIZED;
}

void toggleMaximize(HWND hwnd) {
  ShowWindow(hwnd, isMaximized(hwnd) ? SW_RESTORE : SW_MAXIMIZE);
}

void beginWindowDrag(HWND hwnd) {
  ReleaseCapture();
  SendMessageW(hwnd, WM_NCLBUTTONDOWN, HTCAPTION, 0);
}

LRESULT hitTestResizeBorder(HWND hwnd, LPARAM lparam) {
  POINT point = {GET_X_LPARAM(lparam), GET_Y_LPARAM(lparam)};
  RECT rect = {};
  GetWindowRect(hwnd, &rect);

  const bool left = point.x >= rect.left && point.x < rect.left + kResizeBorder;
  const bool right = point.x <= rect.right && point.x > rect.right - kResizeBorder;
  const bool top = point.y >= rect.top && point.y < rect.top + kResizeBorder;
  const bool bottom = point.y <= rect.bottom && point.y > rect.bottom - kResizeBorder;

  if (top && left) return HTTOPLEFT;
  if (top && right) return HTTOPRIGHT;
  if (bottom && left) return HTBOTTOMLEFT;
  if (bottom && right) return HTBOTTOMRIGHT;
  if (left) return HTLEFT;
  if (right) return HTRIGHT;
  if (top) return HTTOP;
  if (bottom) return HTBOTTOM;
  return HTCLIENT;
}

void handleWebMessage(HWND hwnd, ICoreWebView2WebMessageReceivedEventArgs* args) {
  LPWSTR json = nullptr;
  if (FAILED(args->get_WebMessageAsJson(&json)) || !json) return;

  const std::wstring message(json);
  CoTaskMemFree(json);

  if (message.find(L"minimize") != std::wstring::npos) {
    ShowWindow(hwnd, SW_MINIMIZE);
  } else if (message.find(L"maximize") != std::wstring::npos) {
    toggleMaximize(hwnd);
  } else if (message.find(L"close") != std::wstring::npos) {
    PostMessageW(hwnd, WM_CLOSE, 0, 0);
  } else if (message.find(L"drag") != std::wstring::npos && !isMaximized(hwnd)) {
    beginWindowDrag(hwnd);
  }
}

LRESULT CALLBACK windowProc(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam) {
  switch (message) {
    case WM_NCHITTEST: {
      LRESULT resizeHit = hitTestResizeBorder(hwnd, lparam);
      if (resizeHit != HTCLIENT) return resizeHit;
      return HTCLIENT;
    }
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
      WS_EX_APPWINDOW,
      kWindowClass,
      L"LSearch",
      WS_POPUP | WS_MINIMIZEBOX | WS_MAXIMIZEBOX | WS_SYSMENU,
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
                      EventRegistrationToken token = {};
                      webview->add_WebMessageReceived(
                          Callback<ICoreWebView2WebMessageReceivedEventHandler>(
                              [hwnd](ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT {
                                handleWebMessage(hwnd, args);
                                return S_OK;
                              })
                              .Get(),
                          &token);
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
