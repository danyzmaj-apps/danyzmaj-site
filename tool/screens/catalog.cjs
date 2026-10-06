// Screens canvas catalog: groups -> screens -> states, in canvas order.
// Each state: id (hardcoded kebab, "<group>--<screen>--<state>"), name, state,
// path (served from the repo root), source (the file that declares the page),
// optional act(page, h) to drive to the state, optional `allowFail` (URL
// substrings allowed to 404/abort for error states), optional `fail` (URL
// substrings the fake server answers with 404), optional `freeze` (true: the
// state pauses its own animations, so the screenshot keeps them as they are).

// Holds the rampage timeline at `ms`, exactly as index.html's own tick() does
// (currentTime on every non-idle CSSAnimation), then pauses everything so the
// frame is deterministic. Idle life (pulse/blink/lure) is parked at 0.
const rampageAt = ms => async page => {
  await page.evaluate(async ms => {
    document.documentElement.classList.add('rampage');
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (const a of document.getAnimations()) {
      a.pause();
      a.currentTime = a instanceof CSSAnimation && !/^(pulse|blink|lure)$/.test(a.animationName) ? ms : 0;
    }
  }, ms);
};

const burn = async page => {
  await page.locator('.trigger, body').first().focus().catch(() => {});
  for (let i = 0; i < 5; i++) await page.keyboard.press('PageDown');
  await page.waitForFunction(() => document.documentElement.classList.contains('burned'), null, {timeout: 15000});
  await page.waitForTimeout(900);
};

const openProjects = async page => {
  await page.click('.projects-link');
  await page.waitForFunction(() => location.hash === '#projects');
  await page.waitForTimeout(900);
};

const click = sel => async page => {
  await page.click(sel);
  await page.waitForTimeout(400);
};

// The capture context prefers a dark color scheme; this flips one state to light.
const light = async page => {
  await page.emulateMedia({colorScheme: 'light'});
  await page.waitForTimeout(300);
};

const groups = [
  {id: 'home', name: 'Homepage', screens: [
    {id: 'home--landing--rest', name: 'Landing', state: 'At rest (ink monogram)', path: '/', source: 'index.html'},
    {id: 'home--landing--rampage-awake', name: 'Landing', state: 'Rampage 1400ms: dragon assembled', path: '/', source: 'index.html', freeze: true, act: rampageAt(1400),
      note: 'Timeline held at a fixed currentTime, the same mechanism the scroll scrubber uses.'},
    {id: 'home--landing--rampage-liftoff', name: 'Landing', state: 'Rampage 1900ms: liftoff', path: '/', source: 'index.html', freeze: true, act: rampageAt(1900)},
    {id: 'home--landing--rampage-charge', name: 'Landing', state: 'Rampage 2900ms: charge and fire', path: '/', source: 'index.html', freeze: true, act: rampageAt(2900)},
    {id: 'home--landing--rampage-burn', name: 'Landing', state: 'Rampage 3900ms: page burning', path: '/', source: 'index.html', freeze: true, act: rampageAt(3900)},
    {id: 'home--landing--burned', name: 'Landing', state: 'Burned (paper theme)', path: '/', source: 'index.html', act: burn,
      note: 'Reached with real PageDown presses.'},
    {id: 'home--landing--no-js', name: 'Landing', state: 'No JavaScript', path: '/', source: 'index.html', noJs: true},
    {id: 'home--projects--open', name: 'Projects gallery', state: 'Open over ink', path: '/', route: '/#projects', source: 'index.html', act: openProjects},
    {id: 'home--projects--scrolled-end', name: 'Projects gallery', state: 'Scrolled to the last cards', path: '/', route: '/#projects', source: 'index.html',
      act: async page => {
        await openProjects(page);
        await page.evaluate(() => document.querySelectorAll('#projects img[loading="lazy"]').forEach(i => { i.loading = 'eager'; }));
        await page.mouse.move(720, 450);
        await page.mouse.wheel(0, 20000);
        await page.waitForTimeout(600);
      }},
    {id: 'home--projects--open-paper', name: 'Projects gallery', state: 'Open over paper', path: '/', route: '/#projects', source: 'index.html',
      act: async page => { await burn(page); await openProjects(page); }},
  ]},
  {id: 'holdup', name: 'Hold Up', screens: [
    {id: 'holdup--product--default', name: 'Product page', state: 'Default sign', path: '/holdup/', source: 'holdup/index.html'},
    {id: 'holdup--product--scenario-ink', name: 'Product page', state: 'Name scenario on black', path: '/holdup/', source: 'holdup/index.html',
      act: async page => { await page.click('.scenario[data-message="DANIJEL"]'); await page.click('[data-color="ink"]'); await page.waitForTimeout(400); }},
    {id: 'holdup--product--custom-orange', name: 'Product page', state: 'Typed message on orange', path: '/holdup/', source: 'holdup/index.html',
      act: async page => { await page.fill('#message', 'GATE 12 →'); await page.click('[data-color="ember"]'); await page.locator('#message').blur(); await page.waitForTimeout(400); }},
    {id: 'holdup--product--empty', name: 'Product page', state: 'Empty message placeholder', path: '/holdup/', source: 'holdup/index.html',
      act: async page => { await page.fill('#message', ''); await page.locator('#message').blur(); await page.waitForTimeout(400); }},
    {id: 'holdup--privacy--default', name: 'Privacy policy', state: 'Default', path: '/holdup/privacy/', source: 'holdup/privacy/index.html'},
  ]},
  {id: 'pixelpup', name: 'PixelPup', screens: [
    {id: 'pixelpup--product--default', name: 'Product page', state: 'Meadow day, Labrador', path: '/pixelpup/', source: 'pixelpup/index.html'},
    {id: 'pixelpup--product--night', name: 'Product page', state: 'Meadow Dusk (night toggle)', path: '/pixelpup/', source: 'pixelpup/index.html', act: click('#mode')},
    {id: 'pixelpup--product--shoreline', name: 'Product page', state: 'Shoreline palette', path: '/pixelpup/', source: 'pixelpup/index.html', act: click('.swatch[data-palette="shoreline"]')},
    {id: 'pixelpup--product--gallery-pick', name: 'Product page', state: 'Breed picked from gallery (Beagle)', path: '/pixelpup/', source: 'pixelpup/index.html', act: click('.pup[data-dog="beagle"]')},
    {id: 'pixelpup--product--world-pick', name: 'Product page', state: 'Night Shore picked from palette cards', path: '/pixelpup/', source: 'pixelpup/index.html', act: click('.world-pick[aria-label="Preview the Night Shore palette"]')},
    {id: 'pixelpup--product--preview-error', name: 'Product page', state: 'Preview failed to load', path: '/pixelpup/', source: 'pixelpup/index.html',
      fail: ['/pixelpup/assets/dog_poodle.png'], act: async page => { await page.selectOption('#breed', 'poodle'); await page.waitForSelector('#preview-error:not([hidden])'); }},
    {id: 'pixelpup--privacy--default', name: 'Privacy policy', state: 'Default', path: '/pixelpup/privacy/', source: 'pixelpup/privacy/index.html'},
    {id: 'pixelpup--terms--default', name: 'Terms', state: 'Default', path: '/pixelpup/terms/', source: 'pixelpup/terms/index.html'},
  ]},
  {id: 'pixelmew', name: 'PixelMew', screens: [
    {id: 'pixelmew--product--default', name: 'Product page', state: 'Cardboard Club day, Black Shorthair', path: '/pixelmew/', source: 'pixelmew/index.html'},
    {id: 'pixelmew--product--lamplight', name: 'Product page', state: 'Lamplight (night toggle)', path: '/pixelmew/', source: 'pixelmew/index.html', act: click('#dark-mode')},
    {id: 'pixelmew--product--nightlight', name: 'Product page', state: 'Nightlight family', path: '/pixelmew/', source: 'pixelmew/index.html', act: click('.theme[data-family="2"]')},
    {id: 'pixelmew--product--gallery-pick', name: 'Product page', state: 'Cat picked from gallery (Calico)', path: '/pixelmew/', source: 'pixelmew/index.html', act: click('.cat[data-cat="4"]')},
    {id: 'pixelmew--product--world-pick', name: 'Product page', state: 'Loose Stitch picked from room cards', path: '/pixelmew/', source: 'pixelmew/index.html', act: click('.world-pick[data-theme="2"]')},
    {id: 'pixelmew--product--preview-error', name: 'Product page', state: 'Preview failed to load', path: '/pixelmew/', source: 'pixelmew/index.html',
      fail: ['/pixelmew/faces/cat-siamese.svg'], act: async page => { await page.selectOption('#cat-select', {label: 'Siamese'}); await page.waitForSelector('#preview-error:not([hidden])'); }},
  ]},
  {id: 'pixelzoo', name: 'PixelZoo', screens: [
    {id: 'pixelzoo--product--default', name: 'Product page', state: 'Savanna day, Lion', path: '/pixelzoo/', source: 'pixelzoo/index.html'},
    {id: 'pixelzoo--product--night', name: 'Product page', state: 'Savanna Night (night toggle)', path: '/pixelzoo/', source: 'pixelzoo/index.html', act: click('#mode')},
    {id: 'pixelzoo--product--jungle', name: 'Product page', state: 'Jungle habitat', path: '/pixelzoo/', source: 'pixelzoo/index.html', act: click('.swatch[data-habitat="jungle"]')},
    {id: 'pixelzoo--product--gallery-pick', name: 'Product page', state: 'Animal picked from gallery (Giant Panda)', path: '/pixelzoo/', source: 'pixelzoo/index.html', act: click('.beast[data-animal="giant_panda"]')},
    {id: 'pixelzoo--product--world-pick', name: 'Product page', state: 'Arctic Night picked from habitat cards', path: '/pixelzoo/', source: 'pixelzoo/index.html', act: click('.world-pick[aria-label="Preview the Arctic Night habitat"]')},
    {id: 'pixelzoo--product--preview-error', name: 'Product page', state: 'Preview failed to load', path: '/pixelzoo/', source: 'pixelzoo/index.html',
      fail: ['/pixelzoo/assets/animal_zebra.png'], act: async page => { await page.selectOption('#animal', 'zebra'); await page.waitForSelector('#preview-error:not([hidden])'); }},
    {id: 'pixelzoo--privacy--default', name: 'Privacy policy', state: 'Default', path: '/pixelzoo/privacy/', source: 'pixelzoo/privacy/index.html'},
    {id: 'pixelzoo--terms--default', name: 'Terms', state: 'Default', path: '/pixelzoo/terms/', source: 'pixelzoo/terms/index.html'},
  ]},
  {id: 'vedro', name: 'Vedro', screens: [
    {id: 'vedro--product--default', name: 'Product page', state: 'Leave now (default verdict)', path: '/vedro/', source: 'vedro/index.html'},
    {id: 'vedro--product--afternoon', name: 'Product page', state: 'This afternoon: clear', path: '/vedro/', source: 'vedro/index.html', act: click('#scn-afternoon')},
    {id: 'vedro--product--tomorrow', name: 'Product page', state: 'Tomorrow morning: bad', path: '/vedro/', source: 'vedro/index.html', act: click('#scn-tomorrow')},
    {id: 'vedro--product--no-js', name: 'Product page', state: 'No JavaScript (buttons hidden)', path: '/vedro/', source: 'vedro/index.html', noJs: true},
    {id: 'vedro--privacy--default', name: 'Privacy policy', state: 'Default', path: '/vedro/privacy/', source: 'vedro/privacy/index.html'},
  ]},
  {id: 'evido', name: 'Evido (unlinked)', screens: [
    {id: 'evido--product--worker', name: 'Product page', state: 'Worker walkthrough', path: '/evido/', source: 'evido/index.html'},
    {id: 'evido--product--owner', name: 'Product page', state: 'Owner walkthrough', path: '/evido/', source: 'evido/index.html', act: click('label[for="owner"]')},
    {id: 'evido--privacy--default', name: 'Privacy policy', state: 'Default', path: '/evido/privacy/', source: 'evido/privacy/index.html'},
  ]},
  {id: 'hopjar', name: 'Hopjar', screens: [
    {id: 'hopjar--support--light', name: 'Support page', state: 'Light appearance', path: '/hopjar/', source: 'hopjar/index.html', act: light},
    {id: 'hopjar--support--dark', name: 'Support page', state: 'Dark appearance', path: '/hopjar/', source: 'hopjar/index.html'},
    {id: 'hopjar--privacy--light', name: 'Privacy policy', state: 'Light appearance', path: '/hopjar/privacy/', source: 'hopjar/privacy/index.html', act: light},
    {id: 'hopjar--privacy--dark', name: 'Privacy policy', state: 'Dark appearance', path: '/hopjar/privacy/', source: 'hopjar/privacy/index.html'},
  ]},
  {id: 'tools', name: 'Developer tools', screens: [
    {id: 'tools--shipyard--default', name: 'Shipyard', state: 'Default', path: '/shipyard/', source: 'shipyard/index.html'},
    {id: 'tools--helm--default', name: 'Helm', state: 'Default', path: '/helm/', source: 'helm/index.html'},
  ]},
];

// Phone layouts: each route's main state at 390x844 @2x.
const phone = [
  ['home', 'Homepage', '/', 'index.html'],
  ['projects', 'Projects gallery', '/', 'index.html', openProjects, '/#projects'],
  ['holdup', 'Hold Up', '/holdup/', 'holdup/index.html'],
  ['pixelpup', 'PixelPup', '/pixelpup/', 'pixelpup/index.html'],
  ['pixelmew', 'PixelMew', '/pixelmew/', 'pixelmew/index.html'],
  ['pixelzoo', 'PixelZoo', '/pixelzoo/', 'pixelzoo/index.html'],
  ['vedro', 'Vedro', '/vedro/', 'vedro/index.html'],
  ['evido', 'Evido', '/evido/', 'evido/index.html'],
  ['hopjar', 'Hopjar', '/hopjar/', 'hopjar/index.html'],
  ['shipyard', 'Shipyard', '/shipyard/', 'shipyard/index.html'],
  ['helm', 'Helm', '/helm/', 'helm/index.html'],
];
groups.push({id: 'phone', name: 'Phone 390×844', screens: phone.map(([key, name, path, source, act, route]) => ({
  id: `phone--${key}--default`, name, state: 'Phone', path, source, act, route, device: 'phone',
}))});

module.exports = {groups};
