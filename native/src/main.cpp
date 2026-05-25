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
constexpr wchar_t kDefaultUrl[] = L"http://localhost:3000";

ComPtr<ICoreWebView2Controller> controller;
ComPtr<ICoreWebView2> webview;
PROCESS_INFORMATION serverProcess = {};
HANDLE serverJob = nullptr;

bool fileExists(const std::wstring& path) {
  DWORD attrs = GetFileAttributesW(path.c_str());
  return attrs != INVALID_FILE_ATTRIBUTES && !(attrs & FILE_ATTRIBUTE_DIRECTORY);
}

bool directoryExists(const std::wstring& path) {
  DWORD attrs = GetFileAttributesW(path.c_str());
  return attrs != INVALID_FILE_ATTRIBUTES && (attrs & FILE_ATTRIBUTE_DIRECTORY);
}

std::wstring parentPath(const std::wstring& path) {
  size_t pos = path.find_last_of(L"\\/");
  if (pos == std::wstring::npos) return L"";
  return path.substr(0, pos);
}

std::wstring findProjectRootFrom(std::wstring start) {
  if (fileExists(start + L"\\package.json")) return start;
  for (int i = 0; i < 8; ++i) {
    start = parentPath(start);
    if (start.empty()) break;
    if (fileExists(start + L"\\package.json")) return start;
  }
  return L"";
}

std::wstring findProjectRoot() {
  wchar_t currentDir[MAX_PATH] = {};
  if (GetCurrentDirectoryW(MAX_PATH, currentDir)) {
    std::wstring root = findProjectRootFrom(currentDir);
    if (!root.empty()) return root;
  }

  wchar_t modulePath[MAX_PATH] = {};
  if (GetModuleFileNameW(nullptr, modulePath, MAX_PATH)) {
    return findProjectRootFrom(parentPath(modulePath));
  }

  return L"";
}

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

bool shouldStartServer(const std::vector<std::wstring>& args) {
  for (const auto& arg : args) {
    if (arg == L"--no-server") return false;
  }
  return true;
}

std::wstring readUrlFromArgs(const std::vector<std::wstring>& args) {
  std::wstring url = kDefaultUrl;
  for (const auto& arg : args) {
    if (arg.rfind(L"http://", 0) == 0 || arg.rfind(L"https://", 0) == 0) {
      url = arg;
      break;
    }
  }
  return url;
}

void startNextServer(HWND hwnd, const std::wstring& projectRoot) {
  if (projectRoot.empty()) {
    MessageBoxW(hwnd, L"Impossible de trouver package.json. Lancez LSearch depuis le dossier du projet ou passez une URL.", L"LSearch", MB_ICONWARNING);
    return;
  }

  const bool hasBuild = directoryExists(projectRoot + L"\\.next");
  std::wstring command = hasBuild ? L"cmd.exe /c npm run start -- -p 3000" : L"cmd.exe /c npm run dev -- -p 3000";

  STARTUPINFOW startup = {};
  startup.cb = sizeof(startup);
  startup.dwFlags = STARTF_USESHOWWINDOW;
  startup.wShowWindow = SW_HIDE;

  std::wstring mutableCommand = command;
  serverJob = CreateJobObjectW(nullptr, nullptr);
  if (serverJob) {
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits = {};
    limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    SetInformationJobObject(serverJob, JobObjectExtendedLimitInformation, &limits, sizeof(limits));
  }

  if (!CreateProcessW(
          nullptr,
          mutableCommand.data(),
          nullptr,
          nullptr,
          FALSE,
          CREATE_NO_WINDOW,
          nullptr,
          projectRoot.c_str(),
          &startup,
          &serverProcess)) {
    if (serverJob) {
      CloseHandle(serverJob);
      serverJob = nullptr;
    }
    MessageBoxW(hwnd, L"Impossible de lancer le serveur Next.js. Verifiez que Node.js et npm sont disponibles.", L"LSearch", MB_ICONWARNING);
    return;
  }

  if (serverJob) {
    AssignProcessToJobObject(serverJob, serverProcess.hProcess);
  }
}

void stopNextServer() {
  if (serverProcess.hProcess) {
    if (serverJob) {
      TerminateJobObject(serverJob, 0);
    } else {
      TerminateProcess(serverProcess.hProcess, 0);
    }
    CloseHandle(serverProcess.hProcess);
    CloseHandle(serverProcess.hThread);
    serverProcess = {};
  }
  if (serverJob) {
    CloseHandle(serverJob);
    serverJob = nullptr;
  }
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
      stopNextServer();
      PostQuitMessage(0);
      return 0;
    default:
      return DefWindowProc(hwnd, message, wparam, lparam);
  }
}
}  // namespace

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int showCommand) {
  const std::vector<std::wstring> args = readArgs();
  const std::wstring url = readUrlFromArgs(args);

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

  if (url == kDefaultUrl && shouldStartServer(args)) {
    startNextServer(hwnd, findProjectRoot());
    Sleep(1200);
  }

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
