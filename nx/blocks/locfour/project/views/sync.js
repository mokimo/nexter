import { LitElement, html, nothing } from '../../../../deps/lit/dist/index.js';
import { getConfig } from '../../../../scripts/nexter.js';
import getStyle from '../../../../utils/styles.js';
import getSvg from '../../../../utils/svg.js';
import { convertUrl, overwriteCopy, rolloutCopy, formatDate } from '../index.js';

const { nxBase } = getConfig();
const style = await getStyle(import.meta.url);
const shared = await getStyle(`${nxBase}/blocks/locfour/project/views/shared.js`);
const buttons = await getStyle(`${nxBase}/styles/buttons.js`);

const ICONS = [
  `${nxBase}/blocks/locfour/img/Smock_Checkmark_18_N.svg`,
  `${nxBase}/blocks/locfour/img/Smock_ChevronRight_18_N.svg`,
];

class NxLocSync extends LitElement {
  static properties = {
    details: { attribute: false },
    sourceLang: { attribute: false },
    conflictBehavior: { attribute: false },
    urls: { attribute: false },
    _status: { state: true },
    _syncDate: { state: true },
  };

  connectedCallback() {
    super.connectedCallback();
    this.shadowRoot.adoptedStyleSheets = [style, shared, buttons];
    getSvg({ parent: this.shadowRoot, paths: ICONS });
    this.formatSyncTime();
  }

  formatSyncTime() {
    if (this.sourceLang.lastSync) this._syncDate = formatDate(this.sourceLang.lastSync);
  }

  syncDone() {
    this._status = undefined;
    this.sourceLang.lastSync = Date.now();
    this.formatSyncTime();
    const opts = { detail: true, bubbles: true, composed: true };
    const event = new CustomEvent('done', opts);
    this.dispatchEvent(event);
  }

  async syncUrl(url, destLang) {
    // Delete previous status
    delete url.synced;
    this.requestUpdate();

    const opts = { path: url.extPath, srcLang: url.langPath, destLang };
    const { destination } = convertUrl(opts);

    const copyUrl = {
      source: `/${this.details.org}/${this.details.site}${url.extPath}`,
      destination: `/${this.details.org}/${this.details.site}${destination}`,
    };

    if (this.conflictBehavior === 'overwrite') {
      await overwriteCopy(copyUrl, this.details.title);
    } else {
      await rolloutCopy(copyUrl, this.details.title);
    }

    if (copyUrl.status === 'success') url.synced = true;
    this.requestUpdate();
  }

  async handleSync(e) {
    this._status = `Syncing URLs to ${this.sourceLang.name} for translation.`;
    const { target } = e;
    e.target.disabled = true;
    const { location: destLang } = this.sourceLang;

    await Promise.all(this.urls.map(async (url) => {
      await this.syncUrl(url, destLang);
    }));
    target.disabled = false;
    this.syncDone();
  }

  toggleExpand() {
    this.shadowRoot.querySelector('.da-loc-panel-expand-btn').classList.toggle('rotate');
    this.shadowRoot.querySelector('.da-loc-panel-content').classList.toggle('is-visible');
  }

  render() {
    return html`
      <div class="da-loc-panel">
        <div class="da-loc-panel-title">
          <h3>Sync <span class="quiet">(${this.sourceLang.name})</span></h3>
          <div class="da-loc-panel-title-expand">
            <h3>Behavior: <span class="quiet">${this.conflictBehavior}</span></h3>
            <button class="da-loc-panel-expand-btn" @click=${this.toggleExpand} aria-label="Toggle Expand"><svg class="icon"><use href="#spectrum-chevronRight"/></svg></button>
          </div>
        </div>
        <p class="da-loc-panel-subtitle">Project URLs do not originate from source language used for translation.</p>
        <div class="da-loc-panel-content">
          <ul>
            ${this.urls.map((url) => html`
              <li class="da-loc-sync-url">
                <p>${url.extPath.replace('.html', '')}</p>
                <p>${this.sourceLang.location}${url.extPath.replace('.html', '')}</p>
                <div class="da-loc-sync-check ${url.synced ? 'is-visible' : ''}"><svg class="icon"><use href="#spectrum-check"/></svg></div>
              </li>
            `)}
          </ul>
        </div>
        <div class="da-loc-panel-actions">
          <p>${this._status || html`<strong>Last sync:</strong> ${this._syncDate.date} at ${this._syncDate.time}` || nothing}</p>
          <button class="primary" @click=${this.handleSync}>Sync all</button>
        </div>
      </div>
    `;
  }
}

customElements.define('nx-loc-sync', NxLocSync);
