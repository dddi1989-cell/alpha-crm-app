import { desktopAdapter } from '../adapters/desktopAdapter';
import { webAdapter } from '../adapters/webAdapter';

export const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;

export const api = isElectron ? desktopAdapter : webAdapter;
