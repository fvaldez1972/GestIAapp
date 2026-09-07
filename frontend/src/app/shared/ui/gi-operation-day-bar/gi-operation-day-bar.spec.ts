import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GiSelectOption } from '../gi-select/gi-select';
import { GiOperationDayBar } from './gi-operation-day-bar';

const SERVICIOS: readonly GiSelectOption[] = [
  { value: 'srv-1', label: 'Vigilancia intramuros Torre Altavista' },
  { value: 'srv-2', label: 'Rondín perimetral Parque Norte' },
];

@Component({
  imports: [GiOperationDayBar],
  template: `
    <gi-operation-day-bar
      [date]="date()"
      [operationalToday]="operationalToday()"
      [services]="services()"
      [idService]="idService()"
      [siteLabel]="siteLabel()"
      [maxDate]="maxDate()"
      [publishedVersionLabel]="publishedVersionLabel()"
      (dateChange)="dias.set([...dias(), $event])"
      (serviceChange)="servicios.set([...servicios(), $event])"
      (resolvePrerequisite)="resoluciones.set(resoluciones() + 1)"
    >
      <span class="marcador-proyectado">estado del día</span>
    </gi-operation-day-bar>
  `,
})
class Anfitrion {
  readonly date = signal('2026-09-10');
  readonly operationalToday = signal('2026-09-10');
  readonly services = signal<readonly GiSelectOption[]>(SERVICIOS);
  readonly idService = signal('srv-1');
  readonly siteLabel = signal('Corporativo Altavista · Torre Altavista');
  readonly maxDate = signal('');
  readonly publishedVersionLabel = signal('versión 2, publicada 07 sep 2026');
  readonly dias = signal<string[]>([]);
  readonly servicios = signal<string[]>([]);
  readonly resoluciones = signal(0);
}

function montar(configurar: (host: Anfitrion) => void = () => {}) {
  const fixture = TestBed.createComponent(Anfitrion);
  configurar(fixture.componentInstance);
  fixture.detectChanges();

  const raiz: HTMLElement = fixture.nativeElement;
  const boton = (etiqueta: string) =>
    (Array.from(raiz.querySelectorAll('.gi-bar button')).find(
      (b) => b.textContent?.trim() === etiqueta || b.getAttribute('aria-label')?.startsWith(etiqueta),
    ) as HTMLButtonElement | undefined) ?? null;

  return {
    fixture,
    raiz,
    host: fixture.componentInstance,
    boton,
    actual: () => raiz.querySelector('.gi-bar__current')?.textContent?.trim() ?? null,
  };
}

describe('GiOperationDayBar', () => {
  it('nombra el día con su día de la semana, en el formato único de la aplicación', () => {
    const { actual } = montar();

    expect(actual()).toBe('Jueves 10 sep 2026');
  });

  /**
   * El paso de día se calcula con la aritmética en UTC de `shiftOperationalDate`. Construir la
   * fecha con la hora local corre el resultado un día en cualquiera de los dos sentidos según el
   * signo del huso, que es justo el defecto que se cerró en el servidor y volvió por el navegador.
   */
  it('avanza y retrocede un día sin que el huso del navegador intervenga', () => {
    const { boton, host } = montar();

    boton('Día anterior')!.click();
    boton('Día siguiente')!.click();

    expect(host.dias()).toEqual(['2026-09-09', '2026-09-11']);
  });

  it('cruza el cambio de mes sin saltarse días', () => {
    const { boton, host } = montar((h) => h.date.set('2026-09-30'));

    boton('Día siguiente')!.click();

    expect(host.dias()).toEqual(['2026-10-01']);
  });

  /**
   * «Ir a hoy» sólo aparece cuando no estás en hoy. Un botón que no hace nada ocupa lugar y enseña
   * a ignorar la barra.
   */
  it('ofrece volver a hoy sólo cuando el día visto no es hoy', () => {
    const enHoy = montar();
    expect(enHoy.boton('Ir a hoy')).toBeNull();

    TestBed.resetTestingModule();
    const enOtroDia = montar((h) => h.date.set('2026-09-08'));
    expect(enOtroDia.boton('Ir a hoy')).not.toBeNull();

    enOtroDia.boton('Ir a hoy')!.click();
    expect(enOtroDia.host.dias()).toEqual(['2026-09-10']);
  });

  /**
   * El tope lo pone la pantalla. Planeación mira hacia adelante; Asistencia no, porque capturar la
   * asistencia de pasado mañana no quiere decir nada.
   */
  it('respeta el tope de la pantalla al avanzar, y sin tope avanza libremente', () => {
    const conTope = montar((h) => {
      h.date.set('2026-09-10');
      h.maxDate.set('2026-09-10');
    });
    expect(conTope.boton('Día siguiente')!.disabled).toBe(true);

    TestBed.resetTestingModule();
    const sinTope = montar();
    expect(sinTope.boton('Día siguiente')!.disabled).toBe(false);
  });

  it('retroceder nunca se topa: el pasado siempre se puede mirar', () => {
    const { boton } = montar((h) => {
      h.date.set('2026-09-10');
      h.maxDate.set('2026-09-10');
    });

    expect(boton('Día anterior')!.disabled).toBe(false);
  });

  /**
   * Sin versión publicada no hay contra qué medir. Se dice, con la salida al lado: un hueco en
   * blanco deja al usuario sin saber si falta un dato o si el día salió perfecto.
   */
  it('cuando no hay versión publicada lo dice y ofrece cómo resolverlo', () => {
    const { raiz, boton, host } = montar((h) => h.publishedVersionLabel.set(''));

    expect(raiz.querySelector('.gi-bar__pill')!.textContent!.trim()).toBe('Sin planeación publicada');
    expect(raiz.querySelector('.gi-bar__version')).toBeNull();

    boton('Publicar la semana')!.click();
    expect(host.resoluciones()).toBe(1);
  });

  it('con versión publicada dice contra qué se compara y no ofrece publicar', () => {
    const { raiz, boton } = montar();

    expect(raiz.querySelector('.gi-bar__version')!.textContent).toContain('versión 2, publicada 07 sep 2026');
    expect(boton('Publicar la semana')).toBeNull();
  });

  /** El selector de servicio es el del sistema, nunca el nativo del sistema operativo. */
  it('el servicio se elige con el selector del sistema y no con un select nativo', () => {
    const { raiz } = montar();

    expect(raiz.querySelector('select')).toBeNull();
    expect(raiz.querySelector('gi-select')).not.toBeNull();
  });

  it('proyecta el estado del día que le pase la pantalla', () => {
    const { raiz } = montar();

    expect(raiz.querySelector('.marcador-proyectado')).not.toBeNull();
  });

  /**
   * La guarda que más importa de las cuatro. El día de hoy calculado con el reloj del navegador
   * estuvo vivo en diez pantallas a la vez, y de las 18:00 en adelante todas proponían el día
   * siguiente. Romper aquí es barato; descubrirlo por la tarde en producción no lo fue.
   */
  it('rompe en desarrollo si el día de hoy no viene del servidor', () => {
    expect(() => montar((h) => h.operationalToday.set(''))).toThrowError(/system\/info/);
    TestBed.resetTestingModule();
    expect(() => montar((h) => h.operationalToday.set('2026-09-10T00:00:00Z'))).toThrowError(
      /yyyy-MM-dd/,
    );
  });

  it('rompe en desarrollo si el día visto trae hora, porque un día de negocio no la tiene', () => {
    expect(() => montar((h) => h.date.set('2026-09-10T18:30:00Z'))).toThrowError(/día de negocio/);
  });

  it('rompe en desarrollo si no hay ningún servicio que elegir', () => {
    expect(() => montar((h) => h.services.set([]))).toThrowError(/vacío de prerrequisito/);
  });
});
