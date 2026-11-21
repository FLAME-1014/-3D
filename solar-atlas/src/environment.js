export async function queryEnvironment(kind, coordinates = {}, options = {}) {
  if (!['weather', 'solar-wind'].includes(kind)) throw new Error('Unknown environment query.');
  const direct = (options.transport ?? globalThis.SOLAR_ATLAS_CONFIG?.dataTransport) === 'direct';
  let url;
  if (kind === 'weather') {
    const lat = Number(coordinates.lat), lon = Number(coordinates.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new Error('经纬度超出有效范围。');
    const position = `latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}`;
    url = direct
      ? `https://api.open-meteo.com/v1/forecast?${position}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=UTC`
      : `./api/weather?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`;
  } else {
    url = direct ? 'https://services.swpc.noaa.gov/products/solar-wind/plasma-2-hour.json' : './api/solar-wind';
  }
  const response = await (options.fetch ?? globalThis.fetch)(url, { signal: AbortSignal.timeout(14000) });
  if (!response.ok) throw new Error(`数据服务暂不可用（HTTP ${response.status}）。`);
  const result = await response.json();
  return direct
    ? { fetchedAt: new Date().toISOString(), source: kind === 'weather' ? 'Open-Meteo' : 'NOAA SWPC', data: result }
    : result;
}
