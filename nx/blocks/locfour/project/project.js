import { LitElement, html, nothing } from '../../../deps/lit/dist/index.js';
import { getConfig } from '../../../scripts/nexter.js';
import getStyle from '../../../utils/styles.js';
import { getDetails, saveStatus } from './index.js';

const { nxBase } = getConfig();
const style = await getStyle(import.meta.url);
const buttons = await getStyle(`${nxBase}/styles/buttons.js`);

class NxLocProject extends LitElement {
  static properties = {
    _state: { state: true },
    _details: { state: true },
    _service: { state: true },
    _sourceLang: { state: true },
    _needsSync: { state: true },
    _translationStatus: { state: true },
    _status: { state: true },
    _langs: { state: true },
    _urls: { state: true },
  };

  connectedCallback() {
    super.connectedCallback();
    this.shadowRoot.adoptedStyleSheets = [style, buttons];
    this.setupProject();
  }

  async setupProject() {
    this._state = await getDetails();
    const {
      title,
      org,
      site,
      config,
      options,
      sourceLang,
      langs,
      urls,
    } = this._state;

    this._config = config;
    this._details = { title, org, site, options };
    this._sourceLang = sourceLang || { location: '/' };
    this._langs = langs;
    this._urls = urls;

    const needsSync = this._urls[0].langPath !== this._sourceLang.location;
    const translateLangs = this._langs.filter((lang) => lang.action === 'translate');
    const rolloutLangs = this._langs.filter((lang) => lang.locales);

    if (needsSync) await this.setupSync();
    if (translateLangs.length > 0) await this.setupTranslate(translateLangs);
    if (rolloutLangs.length > 0) await this.setupRollout(rolloutLangs);
  }

  async setupSync() {
    await import('./views/sync.js');
    const cmp = document.createElement('nx-loc-sync');
    cmp.addEventListener('done', () => { saveStatus(this._state); });
    cmp.sourceLang = this._sourceLang;
    cmp.details = this._details;
    cmp.conflictBehavior = this._details.options.sourceConflict;
    cmp.urls = this._urls;
    this.shadowRoot.append(cmp);
  }

  async setupTranslate(langs) {
    await import('./views/translate.js');
    const cmp = document.createElement('nx-loc-translate');
    cmp.state = this._state;
    cmp.details = this._details;
    cmp.config = this._config;
    cmp.sourceLang = this._sourceLang;
    cmp.conflictBehavior = this._details.options.returnConflict;
    cmp.langs = langs;
    cmp.urls = this._urls;
    this.shadowRoot.append(cmp);
  }

  async setupRollout(langs) {
    await import('./views/rollout.js');
    const cmp = document.createElement('nx-loc-rollout');
    cmp.details = this._details;
    cmp.conflictBehavior = this._details.options.rolloutConflict;
    cmp.langs = langs;
    cmp.urls = this._urls;
    this.shadowRoot.append(cmp);
  }

  render() {
    if (!this._details) return nothing;

    return html`
      <p class="da-loc-detail-org">${this._details.org} / ${this._details.site}</p>
      <h2 class="da-loc-detail-title">${this._details.title}</h2>
    `;
  }
}

customElements.define('nx-loc-project', NxLocProject);
