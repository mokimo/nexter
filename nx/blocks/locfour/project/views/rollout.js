import { LitElement, html, nothing } from '../../../../deps/lit/dist/index.js';
import { getConfig } from '../../../../scripts/nexter.js';
import getSvg from '../../../../utils/svg.js';
import getStyle from '../../../../utils/styles.js';

const { nxBase } = getConfig();
const style = await getStyle(import.meta.url);
const shared = await getStyle(`${nxBase}/blocks/locfour/project/views/shared.js`);
const buttons = await getStyle(`${nxBase}/styles/buttons.js`);

const ICONS = [
  `${nxBase}/blocks/locfour/img/Smock_ChevronRight_18_N.svg`,
];

class NxLocRollout extends LitElement {
  static properties = {
    conflictBehavior: { attribute: false },
    details: { attribute: false },
    langs: { attribute: false },
    urls: { attribute: false },
  };

  connectedCallback() {
    super.connectedCallback();
    this.shadowRoot.adoptedStyleSheets = [style, shared, buttons];
    getSvg({ parent: this.shadowRoot, paths: ICONS });
  }

  toggleExpand() {
    this.shadowRoot.querySelector('.da-loc-panel-expand-btn').classList.toggle('rotate');
    this.shadowRoot.querySelector('.da-loc-panel-content').classList.toggle('is-visible');
  }

  async handleRolloutLang(lang) {
    if (!lang.rollout) return;
    lang.rolledOut = 0;
    lang.locales.map((locale) => {
      this.urls.forEach(async (url) => {
        const sourcePath = `${this.details.sitePrefix}${lang.location}${url.basePath}`;
        const destPath = `${this.details.sitePrefix}${locale.code}${url.basePath}`;
        console.log(destPath);
        lang.rolledOut += 1;
      });
      this.requestUpdate();
    });
  }

  async handleRolloutAll() {
    for (const lang of this.langs) {
      await this.handleRolloutLang(lang);
    }
  }

  getLangStatus(lang) {
    if (lang.rollout?.status) return lang.rollout.status;
    if (lang.action === 'rollout') return 'ready';
    return 'not ready';
  }

  canRollout(lang) {
    if (lang.action === 'rollout') return true;
    if (lang.rollout?.status === 'ready') return true;
    return false;
  }

  get _totalRollout() {
    const total = this.langs.reduce((acc, lang) => {
      let count = acc;
      count += lang.locales.length * this.urls.length;
      return count;
    }, 0);
    return total.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ',');
  }

  get _canRolloutAll() {
    const ready = this.langs.filter((lang) => lang.action === 'rollout' || lang.rollout?.status === 'ready');
    return this.langs.length === ready.length;
  }

  render() {
    return html`
      <div class="da-loc-panel">
        <div class="da-loc-panel-title">
          <h3>Rollout <span class="quiet">(${this._totalRollout} items)</span></h3>
          <div class="da-loc-panel-title-expand">
            <h3>Behavior: <span class="quiet">${this.conflictBehavior}</span></h3>
            <button class="da-loc-panel-expand-btn" @click=${this.toggleExpand} aria-label="Toggle Expand"><svg class="icon"><use href="#spectrum-chevronRight"/></svg></button>
          </div>
        </div>
        <div class="da-loc-panel-content">
          <div class="da-lang-cards">
            ${this.langs.map((lang) => html`
              <div class="da-lang-card">
                <div class="da-card-header ${this.getLangStatus(lang).replace(' ', '-')}">
                  <div>
                    <p class="da-card-subtitle">Language</p>
                    <p class="da-card-title">${lang.name}</p>
                  </div>
                  <p class="da-card-badge">${this.getLangStatus(lang)}</p>
                </div>
                <div class="da-card-content">
                  <div class="da-card-details rollout">
                    <div>
                      <p class="da-card-subtitle">Ready</p>
                      <p class="da-card-title">${lang.rollout.ready || 0} of ${this.urls.length}</p>
                    </div>
                    <div>
                      <p class="da-card-subtitle">Rolled out</p>
                      <p class="da-card-title">${lang.rolledOut || 0} of ${this.urls.length * lang.locales.length}</p>
                    </div>
                  </div>
                  <div class="da-card-locales">
                    ${lang.locales.map((locale) => html`<button class="action">${locale.code.replace('/', '')}</button>`)}
                  </div>
                </div>
                <div class="da-card-actions">
                  ${this.canRollout(lang) ? html`<button class="primary" @click=${() => this.handleRolloutLang(lang)}>Rollout</button>` : nothing}
                </div>
              </div>
            `)}
          </div>
        </div>
        <div class="da-loc-panel-actions">
          <p></p>
          <button class="primary" @click=${this.handleRolloutAll} ?disabled=${!this._canRolloutAll}>Rollout all</button>
        </div>
      </div>
    `;
  }
}

customElements.define('nx-loc-rollout', NxLocRollout);
