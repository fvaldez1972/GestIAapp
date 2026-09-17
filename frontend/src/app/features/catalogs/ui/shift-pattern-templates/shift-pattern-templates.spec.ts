import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SystemInfoService } from '../../../../core/system/system-info.service';
import { ShiftPatternTemplate, ShiftPatternTemplateInput } from '../../data-access/shift-pattern-template.models';
import { ShiftPatternTemplates } from './shift-pattern-templates';

const HOY = '2026-09-17';
const ORG = '11111111-1111-1111-1111-111111111111';

/**
 * Un 24x24: dos días de veinticuatro horas en un ciclo de dos, que son 168 horas por semana y
 * exceden el límite. El veredicto lo manda el servidor y la pantalla lo repite; aquí se comprueba
 * justo eso, que no lo vuelva a calcular por su cuenta.
 */
function patronFixture(cambios: Partial<ShiftPatternTemplate> = {}): ShiftPatternTemplate {
  return {
    idShiftPatternTemplate: 'p1',
    name: '24x24',
    description: null,
    daypart: 'Rotating',
    cycleDays: 2,
    effectiveFromDate: '2026-01-01',
    effectiveToDate: null,
    active: true,
    days: [
      {
        idShiftPatternTemplateDay: 'd1',
        cycleDayNumber: 1,
        startTime: '07:00:00',
        endTime: '07:00:00',
        isRest: false,
        isOvernight: true,
        durationMinutes: 1440,
      },
      {
        idShiftPatternTemplateDay: 'd2',
        cycleDayNumber: 2,
        startTime: null,
        endTime: null,
        isRest: true,
        isOvernight: false,
        durationMinutes: 0,
      },
    ],
    isComplete: true,
    restDays: 1,
    weeklyHours: 84,
    weeklyLimit: 48,
    compliance: 'Exceeds',
    excessHours: 36,
    restDescription: '1 día de descanso en ciclo de 2 días, se corre respecto a la semana',
    ...cambios,
  };
}

@Component({
  imports: [ShiftPatternTemplates],
  template: `<app-shift-pattern-templates [organizationId]="org()" [canWrite]="canWrite()" />`,
})
class Anfitrion {
  readonly org = signal(ORG);
  readonly canWrite = signal(true);
}

describe('El constructor de patrones de turno', () => {
  let http: HttpTestingController;
  const metodosDeDialogo = ['showModal', 'close'] as const;
  const descriptores = metodosDeDialogo.map((metodo) =>
    Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, metodo),
  );

  beforeEach(() => {
    // jsdom no implementa el diálogo modal. Se sustituye por algo que abra y cierre de verdad, para
    // que el formulario quede en el árbol y las pruebas puedan escribir en él.
    for (const metodo of metodosDeDialogo) {
      Object.defineProperty(HTMLDialogElement.prototype, metodo, {
        configurable: true,
        writable: true,
        value(this: HTMLDialogElement) {
          this.open = metodo === 'showModal';
        },
      });
    }

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // El día operativo lo dice el servidor, y aquí se fija para que la vigencia por omisión no
        // dependa del reloj de la máquina que corre la prueba.
        { provide: SystemInfoService, useValue: { operationDate: () => HOY } },
      ],
    });

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    metodosDeDialogo.forEach((metodo, indice) => {
      const descriptor = descriptores[indice];
      if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, metodo, descriptor);
    });
  });

  function montar(patrones: readonly ShiftPatternTemplate[] = [patronFixture()]) {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();

    const peticion = http.expectOne(
      (request) =>
        request.url === '/api/v1/catalogs/shift-pattern-templates' &&
        request.params.get('organizationId') === ORG,
    );
    peticion.flush(patrones);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;

    return {
      fixture,
      raiz,
      texto: () => raiz.textContent ?? '',
      abrirNuevo: () => {
        raiz.querySelector<HTMLButtonElement>('.gi-button--primary')!.click();
        fixture.detectChanges();
      },
      dias: () => Array.from(raiz.querySelectorAll<HTMLElement>('.pat__dia')),
      escribir: (selector: string, valor: string) => {
        const campo = raiz.querySelector<HTMLInputElement>(selector)!;
        campo.value = valor;
        campo.dispatchEvent(new Event('input'));
        fixture.detectChanges();
      },
      // La hora vive en el formulario, no en un input: se escribe por el control y se lee de ahí.
      elegirHora: (indice: number, campo: 'startTime' | 'endTime', valor: string) => {
        const dias = (fixture.debugElement.children[0].componentInstance as {
          form: { controls: { days: { at(i: number): { controls: Record<string, { setValue(v: string): void }> } } } };
        }).form.controls.days;

        dias.at(indice).controls[campo].setValue(valor);
        fixture.detectChanges();
      },
      horaDe: (indice: number, campo: 'startTime' | 'endTime') => {
        const dias = (fixture.debugElement.children[0].componentInstance as {
          form: { controls: { days: { at(i: number): { controls: Record<string, { value: string }> } } } };
        }).form.controls.days;

        return dias.at(indice).controls[campo].value;
      },
    };
  }

  it('repite el veredicto del servidor en lugar de volver a juzgar el patrón', () => {
    const pantalla = montar();

    expect(pantalla.texto()).toContain('Excede por 36 h');
    expect(pantalla.texto()).toContain('Límite 48 h');
    expect(pantalla.texto()).toContain('84 h');
  });

  it('marca el patrón al que le faltan días por declarar, que es distinto de tener descanso', () => {
    const pantalla = montar([patronFixture({ isComplete: false, cycleDays: 3 })]);

    expect(pantalla.texto()).toContain('Días sin declarar');
  });

  it('los días del ciclo siguen a su longitud y no se pierde lo ya capturado', () => {
    const pantalla = montar();
    pantalla.abrirNuevo();

    expect(pantalla.dias()).toHaveLength(2);

    // La hora se elige en el selector propio, no en el input nativo del navegador: su desplegable
    // no se podía cerrar ni estilizar y tapaba las filas de abajo.
    pantalla.elegirHora(0, 'startTime', '06:00');
    pantalla.escribir('input[type="number"]', '3');

    expect(pantalla.dias()).toHaveLength(3);
    expect(pantalla.horaDe(0, 'startTime')).toBe('06:00');
  });

  it('un día de descanso viaja sin horario, y el número de ciclo lo pone la posición de la fila', () => {
    const pantalla = montar();
    pantalla.abrirNuevo();

    pantalla.escribir('input[type="text"]', '12x12 diurno');

    // El segundo día descansa: se marca la casilla y su horario deja de existir, no se queda vacío.
    const descanso = pantalla
      .dias()[1]
      .querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    descanso.click();
    pantalla.fixture.detectChanges();

    pantalla.raiz.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    pantalla.fixture.detectChanges();

    const peticion = http.expectOne(
      (request) => request.method === 'POST' && request.url === '/api/v1/catalogs/shift-pattern-templates',
    );
    const cuerpo = peticion.request.body as ShiftPatternTemplateInput;

    expect(cuerpo.name).toBe('12x12 diurno');
    expect(cuerpo.cycleDays).toBe(2);
    expect(cuerpo.effectiveFromDate).toBe(HOY);
    expect(cuerpo.days).toEqual([
      { cycleDayNumber: 1, isRest: false, startTime: '07:00', endTime: '19:00' },
      { cycleDayNumber: 2, isRest: true, startTime: null, endTime: null },
    ]);
  });

  /**
   * Las dos cifras, no una.
   *
   * <p>QA reporto que «las horas no se estan contando bien»: cuatro dias de 12 h en un ciclo de
   * seis son 48 h en el ciclo y 56 por semana, y la pantalla solo ensenaba el 56. Los dos numeros
   * eran correctos y parecia que mentia porque faltaba el primero.</p>
   */
  it('la previa dice las horas del ciclo y las de la semana', () => {
    const pantalla = montar();
    pantalla.abrirNuevo();

    // Ciclo de dos dias: un turno de 12 h y un descanso. 12 h en el ciclo, 42 por semana.
    const descanso = pantalla
      .dias()[1]
      .querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    descanso.click();
    pantalla.fixture.detectChanges();

    const previa = pantalla.raiz.querySelector<HTMLElement>('.pat__previa')!.textContent ?? '';

    expect(previa).toContain('12 h de turno');
    expect(previa).toContain('en el ciclo de 2 días');
    expect(previa).toContain('42 h por semana');
  });

  it('sin permiso de escritura no se puede abrir el constructor', () => {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.componentInstance.canWrite.set(false);
    fixture.detectChanges();
    http.expectOne((request) => request.url === '/api/v1/catalogs/shift-pattern-templates').flush([]);
    fixture.detectChanges();

    const boton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.gi-button--primary',
    )!;

    expect(boton.disabled).toBe(true);
  });
});
