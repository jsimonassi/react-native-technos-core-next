#!/usr/bin/env bash
# Copia o TechnosWatchProtocol.xcframework do Repo 1 (technos-watch-protocol) para ios/Frameworks/.
#
# Uso: ios/scripts/sync-xcframework.sh [--build] [--debug]
#   --build  roda ./gradlew assembleTechnosWatchProtocolXCFramework no Repo 1 antes de copiar
#   --debug  copia a variante debug (padrão: release, a que o pod e os testes usam)
# O Repo 1 é procurado em ../technos-watch-protocol (irmão deste repositório) ou em $TECHNOS_WATCH_PROTOCOL_DIR.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo2="$(cd "$here/../.." && pwd)"
repo1="${TECHNOS_WATCH_PROTOCOL_DIR:-$repo2/../technos-watch-protocol}"
variant="release"
build=0

for arg in "$@"; do
	case "$arg" in
		--build) build=1 ;;
		--debug) variant="debug" ;;
		-h | --help)
			sed -n '2,7p' "${BASH_SOURCE[0]}"
			exit 0
			;;
		*)
			echo "Argumento desconhecido: $arg" >&2
			exit 2
			;;
	esac
done

if [[ ! -d "$repo1" ]]; then
	echo "Repo 1 não encontrado em $repo1 (defina TECHNOS_WATCH_PROTOCOL_DIR)." >&2
	exit 1
fi
repo1="$(cd "$repo1" && pwd)"

if [[ "$build" == 1 ]]; then
	(cd "$repo1" && ./gradlew assembleTechnosWatchProtocolXCFramework --console=plain)
fi

source="$repo1/bridge/build/XCFrameworks/$variant/TechnosWatchProtocol.xcframework"
if [[ ! -f "$source/Info.plist" ]]; then
	echo "XCFramework não encontrado em $source." >&2
	echo "Gere com: (cd $repo1 && ./gradlew assembleTechnosWatchProtocolXCFramework), ou rode este script com --build." >&2
	exit 1
fi

target_dir="$repo2/ios/Frameworks"
target="$target_dir/TechnosWatchProtocol.xcframework"
mkdir -p "$target_dir"
rm -rf "$target"
cp -R "$source" "$target"

# O header de cada fatia identifica o que foi copiado (sem o header não há API para o Swift nem para o shim).
for slice in ios-arm64 ios-arm64-simulator; do
	header="$target/$slice/TechnosWatchProtocol.framework/Headers/TechnosWatchProtocol.h"
	if [[ ! -f "$header" ]]; then
		echo "Fatia $slice sem header em $target." >&2
		exit 1
	fi
done
if ! grep -q "TWPCoreBridge" "$target/ios-arm64/TechnosWatchProtocol.framework/Headers/TechnosWatchProtocol.h"; then
	echo "O framework copiado não tem o CoreBridge (é anterior à ADR 21 do Repo 1?)." >&2
	exit 1
fi

commit="$(git -C "$repo1" rev-parse --short HEAD 2>/dev/null || echo "?")"
dirty=""
if [[ -n "$(git -C "$repo1" status --porcelain 2>/dev/null)" ]]; then
	dirty=" (com alterações não commitadas)"
fi
printf '%s\n' "variant=$variant" "repo1Commit=$commit$dirty" "copiedAt=$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$target_dir/VERSION.txt"
echo "Copiado $variant de $repo1 ($commit$dirty) para $target"
