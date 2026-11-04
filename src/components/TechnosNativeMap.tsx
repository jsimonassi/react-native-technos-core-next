import React from "react";
import { View, type ViewProps } from "react-native";
import type { TechnosMapStyles } from "./mapStyles";

/**
 * Relógio achado, para o mapa de "encontrar relógio", cópia literal de `FoundDevice` do Core atual (`TechnosWareCore`
 * `v4.3.57`, `src/NativeComponents/components/TechnosNativeMap/types.ts:3-8`). Como lá, a raiz não exporta o tipo.
 */
export interface FoundDevice {
	name: string;
	latitude: number;
	longitude: number;
	macAddress?: string;
}

/**
 * Props do mapa, cópia literal de `TechnosNativeMapProps` do Core atual (`v4.3.57`,
 * `src/NativeComponents/components/TechnosNativeMap/types.ts:17-32`), com todos os opcionais.
 */
export interface TechnosNativeMapProps extends ViewProps {
	mapMode?: string;
	mapStyle?: TechnosMapStyles;
	mapPadding?: [number, number, number, number];
	foundDeviceList?: FoundDevice[];
	selectedFoundDevice?: FoundDevice;
	zoom?: number;
	locationData?: {
		locations?: {
			latitude: number;
			longitude: number;
			speed: number;
		}[];
		// Cópia literal do Core, inclusive o `Number` (o tipo objeto), para o app trocar de pacote sem mudar os tipos.
		showPinsWithKmDistance?: Number;
	};
}

/**
 * Mapa do Core atual, por enquanto como reserva (stub): uma `View` vazia que recebe as props de `View` (`style`,
 * `testID`...) e descarta as do mapa. Não desenha mapa, rota nem relógios achados: sem GPS na fase 3, o desenho do mapa
 * ficou fora da linha de corte (o resumo de atividades com rota e a localização do relógio ficam em branco). No Core
 * atual é o componente nativo `TechnosNativeMap` (Google Maps).
 *
 * Existe para o app Condor importar e estilizar (`styled(TechnosNativeMap)` no nível do módulo) sem quebrar.
 */
export const TechnosNativeMap = ({
	mapMode: _mapMode,
	mapStyle: _mapStyle,
	mapPadding: _mapPadding,
	foundDeviceList: _foundDeviceList,
	selectedFoundDevice: _selectedFoundDevice,
	zoom: _zoom,
	locationData: _locationData,
	...viewProps
}: TechnosNativeMapProps) => <View {...viewProps} />;
