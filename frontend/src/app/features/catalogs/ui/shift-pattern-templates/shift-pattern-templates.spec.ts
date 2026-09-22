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

  /**
   * La tabla repite el veredicto del servidor en lugar de volver a juzgar el patrón.
   *
   * <p>El límite cambia con la ley, así que la pantalla no puede calcularlo: lo dice el servidor y
   * aquí sólo se enseña. Por eso la prueba da un exceso que <b>no</b> cuadra con la aritmética de
   * las horas del propio patrón: si la pantalla lo recalculara, saldría otro número.</p>
   *
   * <p>Desde el 21 de septiembre de 2026 el aviso sale <b>sólo cuando excede</b> y lleva el límite
   * dentro: una columna que decía «Conforme» en casi todas las filas gastaba ancho para no decir
   * nada, y «excede por 36 h» sin el límite obliga a saberse el número de memoria.</p>
   */
  it('repite el veredicto del servidor en lugar de volver a juzgar el patrón', () => {
    const pantalla = montar();

    expect(pantalla.texto()).toContain('Excede la jornada de 48 h por 36 h');
  });

  /**
   * Y el control: el patrón que no excede no dice nada.
   *
   * <p>Sin esta mitad, «avisa cuando excede» no se distinguiría de avisar siempre, que es de donde
   * venimos.</p>
   */
  it('el patrón que no excede no lleva ningún aviso de jornada', () => {
    const pantalla = montar([
      patronFixture({ compliance: 'Compliant', excessHours: 0, weeklyHours: 40 }),
    ]);

    expect(pantalla.texto()).not.toContain('Excede');
    expect(pantalla.texto()).not.toContain('Conforme');
  });

  /**
   * En una semana los días se llaman por su nombre; fuera de ella se numeran.
   *
   * <p>«Día 1… Día 7» obligaba a traducir mentalmente para saber qué se captura. El día 1 es lunes,
   * que es lo que dicen los nombres de las plantillas —«Rol diurno lunes a sábado»— y el ancla que
   * usó la migración que enlazó las posiciones.</p>
   *
   * <p>La segunda mitad es el control: un ciclo de seis cae en días distintos cada semana, así que
   * no hay ningún martes que nombrar y numerarlos es la única respuesta cierta.</p>
   */
  it('en un ciclo semanal los días se llaman lunes, martes… y fuera de él se numeran', () => {
    const semanal = montar([patronFixture({ cycleDays: 7 })]);
    const pagina = semanal.fixture.debugElement.children[0].componentInstance as unknown as {
      nombreDelDia(n: number): string;
      form: { controls: { cycleDays: { setValue(v: number): void } } };
    };

    // El nombre sale del ciclo que se está capturando, no del patrón de la fila: el cuadro es el
    // único sitio donde se declaran los días, y su ciclo puede cambiarse ahí mismo.
    pagina.form.controls.cycleDays.setValue(7);

    expect(pagina.nombreDelDia(1)).toBe('Lunes');
    expect(pagina.nombreDelDia(7)).toBe('Domingo');

    pagina.form.controls.cycleDays.setValue(6);

    expect(pagina.nombreDelDia(1), 'sin semana no hay día que nombrar').toBe('Día 1');
  });

  it('marca el patrón al que le faltan días por declarar, que es distinto de tener descanso', () => {
    const pantalla = montar([patronFixture({ isComplete: false, cycleDays: 3 })]);

    expect(pantalla.texto()).toContain('Días sin declarar');
  });

  it('los días del ciclo siguen a su longitud y no se pierde lo ya capturado', () => {
    const pantalla = montar();
    pantalla.abrirNuevo();

    // Se baja a 2 a propósito: lo que se comprueba es que las filas SIGUEN al ciclo, no con cuántas
    // arranca. El valor inicial lo fija su propia prueba.
    pantalla.escribir('input[type="number"]', '2');

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
    pantalla.escribir('input[type="number"]', '2');

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
    pantalla.escribir('input[type="number"]', '2');
    const descanso = pantalla
      .dias()[1]
      .querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    descanso.click();
    pantalla.fixture.detectChanges();

    const previa = pantalla.raiz.querySelector<HTMLElement>('.pat__previa')!.textContent ?? '';

    expect(previa).toContain('12 h de turno');
    expect(previa).toContain('en el ciclo de 2 días');
    // «Promedio semanal» y no «horas por semana»: el ciclo de dos días cae en días distintos cada
    // semana, así que 42 no son las horas de ninguna semana concreta. El nombre era la queja.
    expect(previa).toContain('promedio semanal de 42 h');
    expect(previa).toContain('12 h ÷ 2 días × 7 días = 42 h');
  });

  /**
   * Un patrón nuevo nace semanal.
   *
   * <p>Arrancaba en dos días, y eso obligaba a corregir el ciclo antes de capturar nada: diez de
   * las doce plantillas del catálogo son semanales. Mientras el ciclo no era siete, además, los
   * días se llamaban «Día 1» en vez de «Lunes», que es lo que la pantalla venía a arreglar.</p>
   *
   * <p>Y el bloque del ciclo llega <b>plegado</b>. Se abría solo en todos los patrones semanales
   * porque el campo de tipo número entrega su valor como texto y la comparación era contra el
   * número: <c>'7' !== 7</c> es cierto.</p>
   */
  it('un patrón nuevo nace semanal y con el ciclo plegado', () => {
    const pantalla = montar();
    pantalla.abrirNuevo();

    expect(pantalla.dias()).toHaveLength(7);
    expect(pantalla.dias()[0].textContent).toContain('Lunes');
    expect(pantalla.dias()[6].textContent).toContain('Domingo');

    const plegado = pantalla.raiz.querySelector<HTMLDetailsElement>('.pat__ciclo')!;

    expect(plegado.open, 'el ciclo no se enseña cuando es el de siempre').toBe(false);
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
