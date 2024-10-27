import { LitElement, html, nothing } from '../../../../deps/lit/dist/index.js';
import { DA_ORIGIN } from '../../../../public/utils/constants.js';
import { daFetch } from '../../../../utils/daFetch.js';
import { getConfig } from '../../../../scripts/nexter.js';
import getStyle from '../../../../utils/styles.js';
import getSvg from '../../../../utils/svg.js';
import { detectService, saveStatus } from '../index.js';
import dntFetch from '../../dnt/dnt.js';

const { nxBase } = getConfig();
const style = await getStyle(import.meta.url);
const shared = await getStyle(`${nxBase}/blocks/locfour/project/views/shared.css`);
const buttons = await getStyle(`${nxBase}/styles/buttons.js`);

const ICONS = [
  `${nxBase}/blocks/locfour/img/Smock_ChevronRight_18_N.svg`,
];

class NxLocTranslate extends LitElement {
  static properties = {
    state: { attribute: false },
    conflictBehavior: { attribute: false },
    config: { attribute: false },
    sourceLang: { attribute: false },
    langs: { attribute: false },
    urls: { attribute: false },
    _status: { state: true },
    _connected: { state: true },
    _canTranslate: { state: true },
    _service: { state: true },
    _canStatus: { state: true },
  };

  connectedCallback() {
    super.connectedCallback();
    this.shadowRoot.adoptedStyleSheets = [style, shared, buttons];
    getSvg({ parent: this.shadowRoot, paths: ICONS });
    this.connectService();
    this.formatLangs();
    this.formatUrls();
  }

  async connectService() {
    this._service = await detectService(this.config);
    this._connected = await this._service.actions.isConnected(this._service);
    this.toggleActions();
  }

  setStatus(text) {
    if (text) {
      this._status = text;
      return;
    }
    this._status = undefined;
  }

  requestPanelUpdates() {
    const opts = { detail: true, bubbles: true, composed: true };
    const event = new CustomEvent('status', opts);
    this.dispatchEvent(event);
  }

  async saveState() {
    await saveStatus(this.state);
    this.requestPanelUpdates();
  }

  handleConnect() {
    this._service.actions.connect(this._service);
  }

  formatLangs(status = 'not started') {
    this.langs.forEach((lang) => {
      lang.translation.status = status;
    });
  }

  formatUrls() {
    this.urls.forEach((url) => {
      const prefix = this.sourceLang.location === '/' ? '' : this.sourceLang.location;
      url.srcPath = `${this.sitePath}${prefix}${url.basePath}`;
    });
  }

  toggleActions() {
    if (this._service.actions.getStatusAll) {
      this._canTranslate = this.langs.some((lang) => lang.translation.status === 'not started');
      this._canStatus = !this.langs.some((lang) => lang.translation.status === 'complete');
    }
  }

  async sendForTranslation() {
    this.setStatus('Sending to translation provider');

    const saveState = this.saveState.bind(this);
    const setStatus = this.setStatus.bind(this);

    const actions = { setStatus, saveState };

    const { details, _service, langs, urls } = this;
    await this._service.actions.sendAllLanguages(details, _service, langs, urls, actions);

    this._status = undefined;
    this.toggleActions();
  }

  async handleStatus() {
    const saveState = this.saveState.bind(this);
    const setStatus = this.setStatus.bind(this);

    const actions = { setStatus, saveState };

    const { _service, langs } = this;
    await this._service.actions.getStatusAll(_service, langs, actions);
    this.requestUpdate();
  }

  async getSourceContent() {
    this._status = 'Getting source content';

    // Get all the source content
    await Promise.all(this.urls.map(async (url) => {
      const result = await dntFetch(`${DA_ORIGIN}/source${url.srcPath}`, 'capture');
      if (result.error) {
        url.error = result.error;
        url.status = result.status;
        return;
      }
      url.content = result;
    }));

    // Check for errors
    this._errors = this.urls.filter((url) => url.error);
    if (this._errors.length > 0) {
      this._status = 'Errors fetching documents.';
      return false;
    }
    return true;
  }

  async handleTranslateAll(e) {
    const { target } = e;
    target.disabled = true;

    this.formatLangs('sending');
    this.requestPanelUpdates();

    // const contentSuccess = await this.getSourceContent();
    // if (!contentSuccess) return;
    // const sendSuccess = await this.sendForTranslation();
    // if (!sendSuccess) return;
    // target.disabled = false;
  }

  async handleSaveLang(e, lang) {
    const { target } = e;
    target.disabled = true;

    lang.translation.status = 'saving';
    this.requestUpdate();

    const items = await this._service.actions.getItems(this._service, lang, this.urls);
    const results = await Promise.all(items.map(async (item) => {
      const path = `${this.sitePath}${lang.location}${item.basePath}`;
      const body = new FormData();
      body.append('data', item.blob);
      const opts = { body, method: 'POST' };
      try {
        const resp = await daFetch(`${DA_ORIGIN}/source${path}`, opts);
        return { success: resp.status };
      } catch {
        return { error: 'Could not save documents' };
      }
    }));

    const success = results.filter((result) => (result.success)).length;
    lang.translation.saved = success;
    if (success === this.urls.length) {
      lang.translation.status = 'complete';
      lang.rollout = { status: 'ready' };
    }
    this.saveState();

    target.disabled = false;
    this.requestUpdate();
  }

  toggleExpand() {
    this.shadowRoot.querySelector('.da-loc-panel-expand-btn').classList.toggle('rotate');
    this.shadowRoot.querySelector('.da-loc-panel-content').classList.toggle('is-visible');
  }

  renderErrors() {
    return html`
      <div class="da-loc-panel-errors">
        <ul>
          ${this._errors.map((err) => html`
            <li>
              <p><strong>${err.error}</strong></p>
              <p>${err.srcPath}</p>
              ${err.status ? html`<div class="da-error-box">${err.status}</div>` : nothing}
            </li>
          `)}
        </ul>
      </div>`;
  }

  renderActions() {
    if (!this._connected) return nothing;
    if (this._canTranslate) return html`<button class="primary" @click=${this.handleTranslateAll}>Send all for translation</button>`;
    return html`<button class="primary" @click=${this.handleStatus} ?disabled=${!this._canStatus}>Get status</button>`;
  }

  renderSaveLang(lang) {
    return html`<button class="primary" @click=${(e) => { this.handleSaveLang(e, lang); }}>Save</button>`;
  }

  render() {
    return html`
      <div class="da-loc-panel">
        <div class="da-loc-panel-title">
          <h3>Translate <span class="quiet">(${this._service?.name})</span></h3>
          <div class="da-loc-panel-title-expand">
            <h3>Behavior: <span class="quiet">overwrite</span></h3>
            <button class="da-loc-panel-expand-btn" @click=${this.toggleExpand} aria-label="Toggle Expand"><svg class="icon"><use href="#spectrum-chevronRight"/></svg></button>
          </div>
        </div>
        <div class="da-loc-panel-content">
          <div class="da-lang-cards">
            ${this.langs.map((lang) => html`
              <div class="da-lang-card">
                <div class="da-card-header ${lang.translation.status}">
                  <div>
                    <p class="da-card-subtitle">Language</p>
                    <p class="da-card-title">${lang.name}</p>
                  </div>
                  <p class="da-card-badge">${lang.translation.status}</p>
                </div>
                <div class="da-card-content">
                  <div class="da-card-details">
                    <div>
                      <p class="da-card-subtitle">Sent</p>
                      <p class="da-card-title">${lang.translation.sent || 0} of ${this.urls.length}</p>
                    </div>
                    <div>
                      <p class="da-card-subtitle">Translated</p>
                      <p class="da-card-title">${lang.translation.translated || 0} of ${this.urls.length}</p>
                    </div>
                    <div>
                      <p class="da-card-subtitle">Saved</p>
                      <p class="da-card-title">${lang.translation.saved || 0} of ${this.urls.length}</p>
                    </div>
                  </div>
                </div>
                <div class="da-card-actions">
                  ${lang.translation.translated === this.urls.length ? this.renderSaveLang(lang) : nothing}
                </div>
              </div>
            `)}
          </div>
        </div>
        ${this._errors?.length > 0 ? this.renderErrors() : nothing}
        <div class="da-loc-panel-actions">
          <p>${this._status}</p>
          ${this._connected === false ? html`<button class="primary" @click=${this.handleConnect}>Connect</button>` : this.renderActions()}
        </div>
      </div>
    `;
  }
}

customElements.define('nx-loc-translate', NxLocTranslate);
