import { Component } from '@angular/core';

@Component({
  selector: 'app-overview-page',
  templateUrl: './overview-page.html',
  styleUrl: './overview-page.scss',
})
export class OverviewPage {
  protected readonly operationalAreas = [
    {
      label: 'Clientes y servicios',
      value: 'Planificado',
      detail: 'Registro de clientes, sedes, solicitudes y servicios activos',
    },
    {
      label: 'Personal y planeación',
      value: 'Planificado',
      detail: 'Perfiles, disponibilidad, posiciones, turnos y asignaciones',
    },
    {
      label: 'Operación y control',
      value: 'Planificado',
      detail: 'Asistencia, incidencias, coberturas, auditoría y reportes',
    },
  ];
}
