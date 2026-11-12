import { FRAME_KEYS } from './constants';

/**
 * Parsea y valida una trama JSON del ESP32.
 * Lanza Error si falta algún campo o no es numérico (el hook lo cuenta como trama inválida).
 * @param {string} text
 * @returns {{fsr_talon:number,fsr_punta:number,acc_x:number,acc_y:number,acc_z:number,gyr_x:number,gyr_y:number,gyr_z:number}}
 */
export function parseFrame(text) {
  const obj = JSON.parse(text);
  if (!obj || typeof obj !== 'object') throw new Error('Trama no es un objeto');
  const out = {};
  for (const k of FRAME_KEYS) {
    const v = Number(obj[k]);
    if (obj[k] === null || obj[k] === '' || !Number.isFinite(v)) throw new Error(`Campo inválido: ${k}`);
    out[k] = v;
  }
  return out;
}
