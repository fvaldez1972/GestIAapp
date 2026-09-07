// Uses an existing dev server; every API request is intercepted with test fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.GESTIA_PLAYWRIGHT_PATH || 'playwright');
const origin = process.env.GESTIA_TEST_URL || 'http://127.0.0.1:4301';
const output = process.env.GESTIA_TEST_OUTPUT || path.join(require('node:os').tmpdir(), 'gestia-services-qa');
const org = { idOrganization: 'org-a', codeOrganization: 'QA', legalName: 'QA Organization', active: true };
const client = { idClient: 'client-a', idOrganization: 'org-a', codeClient: 'CLIENT', legalName: 'QA Client', tradeName: 'QA Client', active: true };
const service = {
  idService: 'service-a', idClient: 'client-a', idClientSite: 'site-a', clientSiteName: 'Sede principal',
  codeService: 'QA-SERVICE', name: 'Servicio de vigilancia', description: 'Accesos y recorridos preventivos',
  startDate: '2026-09-01', endDate: null, active: true,
};
const position = { idPosition: 'position-a', idService: 'service-a', codePosition: 'ACCESS', name: 'Control de acceso', requiredWorkerCount: 2, active: true };
const pattern = { idShiftPattern: 'pattern-a', idPosition: 'position-a', codeShiftPattern: 'WEEK', name: 'Jornada semanal', effectiveFromDate: '2026-09-01', effectiveToDate: null, active: true };
const employee = { idEmployee: 'employee-a', codeEmployee: 'QA-EMP', fullName: 'Persona de prueba', status: 'Active' };
const paged = items => ({ items, totalCount: items.length, page: 1, pageSize: 20, totalPages: items.length ? 1 : 0 });

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [], unexpected = [], requests = [];
  try {
    const context = await browser.newContext();
    await context.addInitScript(organization => {
      localStorage.setItem('gestia.auth.session', JSON.stringify({
        accessToken: 'local-ui-fixture', expiresAt: '2099-01-01T00:00:00Z',
        user: { idUser: 'qa-user', displayName: 'QA User', email: 'qa@example.invalid' },
        organizations: [organization],
        permissions: ['CLIENTS.READ', 'CLIENTS.WRITE', 'PLANNING.READ', 'PLANNING.WRITE', 'WORKFORCE.READ', 'DOCUMENTS.READ', 'DOCUMENTS.WRITE'],
      }));
      localStorage.setItem('gestia.auth.activeOrganizationId', organization.idOrganization);
    }, org);
    await context.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url());
      requests.push({ path: url.pathname, query: Object.fromEntries(url.searchParams), method: request.method(), body: request.postDataJSON() });
      let data;
      if (request.method() !== 'GET') {
        if (request.method() === 'POST' && url.pathname.endsWith('/services')) data = { ...service, ...request.postDataJSON() };
        else { unexpected.push(request.method() + ' ' + url.pathname); await route.fulfill({ status: 500, json: {} }); return; }
      } else if (url.pathname === '/api/v1/organizations') data = [org];
      else if (url.pathname === '/api/v1/clients') data = paged([client]);
      else if (url.pathname === '/api/v1/clients/client-a') data = client;
      else if (url.pathname.endsWith('/services')) data = [service];
      else if (url.pathname.endsWith('/sites')) data = [{ idClientSite: 'site-a', name: 'Sede principal', active: true }];
      else if (url.pathname.endsWith('/contacts') || url.pathname.endsWith('/contracts')) data = [];
      else if (url.pathname.endsWith('/configurations')) data = [{
        idServiceConfiguration: 'configuration-a', idService: 'service-a', effectiveFromDate: '2026-09-01', effectiveToDate: null,
        requiredWorkerCount: 2, hoursPerDay: 8, daysPerWeek: 6, averageWeeklyHours: 48, averageMonthlyHours: 208,
        preparationLeadDays: 7, workScheduleDescription: 'Lunes a sabado, 08:00 a 16:00',
        specificInstructions: 'Registro de accesos', monthlyPrice: 20000, currencyCode: 'MXN', isTaxIncluded: false, active: true,
      }];
      else if (url.pathname.endsWith('/positions')) data = [position];
      else if (url.pathname.endsWith('/shift-patterns')) data = [pattern];
      else if (url.pathname.endsWith('/segments')) data = [{ idShiftSegment: 'segment-a', dayOfWeek: 'Monday', startTime: '08:00:00', endTime: '16:00:00', isOvernight: false, durationMinutes: 480, requiredWorkerCount: 2, active: true }];
      else if (url.pathname.endsWith('/assignments')) data = [{ idServiceAssignment: 'assignment-a', idEmployee: 'employee-a', employeeCode: 'QA-EMP', employeeName: 'Persona de prueba', idPosition: 'position-a', positionCode: 'ACCESS', positionName: 'Control de acceso', assignmentType: 'Primary', isPrimary: true, startDate: '2026-09-01', active: true }];
      else if (url.pathname === '/api/v1/employees') data = paged([employee]);
      else if (url.pathname === '/api/v1/documents') data = paged([]);
      else { unexpected.push(request.method() + ' ' + url.pathname); await route.fulfill({ status: 500, json: {} }); return; }
      await route.fulfill({ status: 200, json: data });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [1440, 1071, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(origin + '/servicios?clientId=client-a&serviceId=service-a');
      try {
        await page.getByRole('heading', { name: 'Servicio de vigilancia', exact: true }).waitFor({ timeout: 15000 });
      } catch (error) {
        await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
        console.error(JSON.stringify({ url: page.url(), errors, unexpected, requests, text: await page.locator('body').innerText() }, null, 2));
        throw error;
      }
      await page.getByText('Cargando datos', { exact: false }).waitFor({ state: 'hidden' });
      assert.equal(await page.locator('app-services-page select[aria-label="Organización"]').inputValue(), 'org-a', 'Organization selector reflects loaded context');
      assert.equal(await page.locator('app-services-page select[aria-label="Cliente"]').inputValue(), 'client-a', 'Client selector reflects the deep link');
      assert.equal(await page.locator('app-services-page app-clients-page').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'No page overflow at ' + width);
      await page.screenshot({ path: path.join(output, 'services-' + width + '.png'), fullPage: true });
      const tabs = page.getByRole('navigation', { name: 'Detalle del servicio' });
      await tabs.getByRole('button', { name: 'Posiciones y turnos' }).click();
      await page.getByRole('heading', { name: 'Segmentos semanales' }).waitFor();
      await tabs.getByRole('button', { name: 'Asignaciones' }).click();
      await page.getByText('Persona de prueba', { exact: true }).waitFor();
      await tabs.getByRole('button', { name: 'Documentos' }).click();
      await page.locator('app-entity-documents').waitFor();
      await page.screenshot({ path: path.join(output, 'service-documents-' + width + '.png'), fullPage: true });
      await page.getByRole('button', { name: 'Nuevo servicio', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      await page.screenshot({ path: path.join(output, 'service-editor-' + width + '.png'), fullPage: true });
      await dialog.getByRole('button', { name: 'Cerrar', exact: true }).focus();
      await page.keyboard.press('Shift+Tab');
      assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true, 'Modal focus remains inside');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
    }
    const documentRequest = requests.find(r => r.path === '/api/v1/documents');
    assert.deepEqual({ ownerType: documentRequest.query.ownerType, ownerId: documentRequest.query.ownerId, organizationId: documentRequest.query.organizationId },
      { ownerType: 'Service', ownerId: 'service-a', organizationId: 'org-a' });
    await page.goto(origin + '/servicios?clientId=client-a');
    await page.getByRole('button', { name: 'Nuevo servicio', exact: true }).waitFor();
    await page.getByText('Cargando datos', { exact: false }).waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Nuevo servicio', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Código', { exact: false }).fill('QA-NEW');
    await dialog.getByLabel('Nombre', { exact: false }).fill('Servicio nuevo');
    await dialog.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await dialog.getByLabel('Descripción *', { exact: true }).fill('Alcance de prueba');
    await dialog.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await dialog.getByRole('button', { name: 'Crear servicio', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert(requests.some(r => r.method === 'POST' && r.body?.idOrganization === 'org-a' && r.body?.idClient === 'client-a'));
    await page.goto(origin + '/clientes');
    await page.getByRole('navigation', { name: 'Secciones de cliente' }).getByRole('button', { name: 'Servicios' }).click();
    const link = page.getByRole('link', { name: 'Abrir servicio', exact: true });
    await link.waitFor();
    const href = await link.getAttribute('href');
    assert(href.includes('/servicios?') && href.includes('clientId=client-a') && href.includes('serviceId=service-a'));
    assert.equal(await page.locator('app-clients-page [formcontrolname="codeService"]').count(), 0);
    assert.deepEqual(unexpected, []);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, widths: [1440, 1071, 768, 390], documentScope: documentRequest.query, screenshots: output, errors }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
