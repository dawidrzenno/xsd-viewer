@echo off
REM Disable command echoing so the console shows only intentional output from this script
REM and from the tools it launches, instead of printing every batch line before execution.

setlocal
REM Start a local environment scope so any variables created below exist only for the
REM lifetime of this script and do not leak into the caller's command prompt session.

set "XSD_VIEWER_DIR=%~dp0"
REM Capture the directory that contains this batch file itself. `%~dp0` expands to the
REM drive and path of the running script, which makes the script location-independent.

if "%XSD_VIEWER_DIR:~-1%"=="\" set "XSD_VIEWER_DIR=%XSD_VIEWER_DIR:~0,-1%"
REM `%~dp0` normally ends with a trailing backslash. Remove that trailing slash so later
REM path concatenation stays consistent and string comparisons behave predictably.

for %%I in ("%XSD_VIEWER_DIR%\..") do set "ROOT_DIR=%%~fI"
REM Resolve the parent directory of `xsd-viewer` into an absolute normalized path.
REM The `for` trick is a common batch pattern for asking CMD to canonicalize a path.

set "HOMEPAGE_DIR=%ROOT_DIR%\homepage"
REM Build the expected absolute path to the sibling `homepage` project, which is the
REM first app we need to build and also the directory that contains `docker-compose.yml`.

if not exist "%HOMEPAGE_DIR%\package.json" (
  REM Validate that the expected `homepage` project actually exists before attempting
  REM to change directories or run npm commands inside it.
  echo homepage package.json not found: "%HOMEPAGE_DIR%"
  REM Print a concrete error message that includes the resolved path to make diagnosis
  REM easy if the repository layout changes or the script is moved.
  exit /b 1
  REM Abort immediately with a non-zero exit code so callers can detect failure.
)

if not exist "%XSD_VIEWER_DIR%\package.json" (
  REM Validate that the script is still located inside a usable `xsd-viewer` project.
  echo xsd-viewer package.json not found: "%XSD_VIEWER_DIR%"
  REM Show the resolved path for troubleshooting if this script gets copied elsewhere.
  exit /b 1
  REM Stop execution because running npm in the wrong location would be misleading.
)

pushd "%HOMEPAGE_DIR%" || exit /b 1
REM Change into the `homepage` directory and remember the previous directory on CMD's
REM directory stack. If the directory change fails for any reason, exit right away.

call npm run build
REM Run the `homepage` build and wait for it to finish. `call` is used so control
REM returns to this batch file reliably after the command completes.

if errorlevel 1 (
  REM Check whether the previous command failed with exit code 1 or higher.
  popd
  REM Restore the original working directory before leaving, keeping shell state clean.
  exit /b 1
  REM Propagate failure immediately instead of continuing to later steps.
)

popd
REM Return from `homepage` to the directory that was active before the previous `pushd`.

pushd "%XSD_VIEWER_DIR%" || exit /b 1
REM Enter the `xsd-viewer` project directory so its build runs in the correct context.

call npm run build
REM Run the `xsd-viewer` production build and wait until it completes before moving on.

if errorlevel 1 (
  REM If the `xsd-viewer` build fails, stop here rather than attempting Docker startup.
  popd
  REM Restore the prior working directory before exiting on error.
  exit /b 1
  REM Return a failing status code to the caller.
)

popd
REM Leave the `xsd-viewer` directory and restore the prior current directory.

pushd "%HOMEPAGE_DIR%" || exit /b 1
REM Switch back into `homepage` because that is where `docker compose` must be run in
REM this repository layout in order to find the compose file and related build context.

docker compose up --build
REM Build container images as needed and then start the compose application. This command
REM runs in the foreground and naturally waits until Docker exits or is interrupted.

set "EXIT_CODE=%ERRORLEVEL%"
REM Store Docker's exit code immediately, because subsequent commands like `popd` would
REM otherwise overwrite `%ERRORLEVEL%` and lose the real result of `docker compose`.

popd
REM Restore the caller's previous working directory after Docker terminates.

exit /b %EXIT_CODE%
REM Exit the batch script with the exact status returned by `docker compose`, allowing
REM external callers, CI scripts, or wrappers to detect success or failure accurately.
