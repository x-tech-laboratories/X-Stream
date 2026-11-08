{ pkgs ? import <nixpkgs> { } }:

pkgs.mkShell {
  packages = with pkgs; [
    nodejs_24   # The app, its build and tests
    electron    # Runs the desktop app; the npm one cannot start on NixOS
    git
  ];

  shellHook = ''
    echo "X-Stream dev environment"
    echo "  node      $(node --version)"
    echo "  electron  ${pkgs.electron.version}"
    echo ""
    echo "  Desktop:  npm run dev"

    # npm skips Electron's download and electron-vite starts the nixpkgs one instead.
    export ELECTRON_SKIP_BINARY_DOWNLOAD=1
    export ELECTRON_EXEC_PATH="${pkgs.electron}/bin/electron"

    # VSCode's terminal sets this, which makes Electron start as plain Node.
    unset ELECTRON_RUN_AS_NODE
  '';
}
