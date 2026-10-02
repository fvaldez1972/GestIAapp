import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SystemInfoService } from './system-info.service';

const RESPUESTA = {
  application: 'GestIA',
  apiVersion: 'v1',
  status: 'ready',
  persistence: 'SQL Server',
  operationDate: '2026-09-04',
  timeZoneId: 'America/Mexico_City',
};

describe('SystemInfoService', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('publica el día operativo y el huso que dice el servidor', () => {
    const service = TestBed.inject(SystemInfoService);
    http.expectOne('/api/v1/system/info').flush(RESPUESTA);

    expect(service.operationDate()).toBe('2026-09-04');
    expect(service.timeZoneId()).toBe('America/Mexico_City');
  });

  /**
   * La decisión que sostiene el bloque de las fechas: sin respuesta, **vacío**. Devolver el día del
   * navegador sería volver a calcular «hoy» en el cliente, que es justo el defecto que se cierra.
   * Un filtro vacío se nota y se llena; un día equivocado se usa sin que nadie lo mire.
   */
  it('no inventa un día mientras el servidor no responde', () => {
    const service = TestBed.inject(SystemInfoService);

    expect(service.operationDate()).toBe('');

    http.expectOne('/api/v1/system/info').flush(RESPUESTA);

    expect(service.operationDate()).toBe('2026-09-04');
  });

  it('tampoco lo inventa cuando la consulta falla', () => {
    const service = TestBed.inject(SystemInfoService);
    http.expectOne('/api/v1/system/info').error(new ProgressEvent('error'));

    expect(service.operationDate()).toBe('');
    expect(service.timeZoneId()).toBe('');
    expect(service.info()).toBeNull();
  });

  it('vuelve a preguntar cuando la pestaña se hace visible', () => {
    const service = TestBed.inject(SystemInfoService);
    http.expectOne('/api/v1/system/info').flush(RESPUESTA);

    document.dispatchEvent(new Event('visibilitychange'));

    // jsdom reporta la pestaña como visible, así que la consulta se repite.
    http.expectOne('/api/v1/system/info').flush({ ...RESPUESTA, operationDate: '2026-09-05' });

    expect(service.operationDate()).toBe('2026-09-05');
  });
});
