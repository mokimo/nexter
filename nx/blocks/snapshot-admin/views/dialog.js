// eslint-disable-next-line import/no-unresolved
import { html, LitElement } from 'da-lit';
import getStyle from '../../../utils/styles.js';
import getSvg from '../../../utils/svg.js';

const nx = `${new URL(import.meta.url).origin}/nx`;
const sl = await getStyle(`${nx}/public/sl/styles.css`);
const style = await getStyle(import.meta.url);

const ICONS = [`${nx}/img/icons/S2IconClose20N-icon.svg`];

class NxDialog extends LitElement {
  static properties = { details: { attribute: false } };

  async connectedCallback() {
    super.connectedCallback();
    this.shadowRoot.adoptedStyleSheets = [sl, style];
    getSvg({ parent: this.shadowRoot, paths: ICONS });
  }

  updated(props) {
    if (props.has('details') && this.details) {
      if (this.details.open) {
        this._dialog.showModal();
      } else {
        this._dialog.close();
      }
    }
  }

  handleAction() {
    const opts = { bubbles: true, composed: true };
    const event = new CustomEvent('action', opts);
    this.dispatchEvent(event);
    this._dialog.close();
  }

  get _dialog() {
    return this.shadowRoot.querySelector('sl-dialog');
  }

  render() {
    return html`
      <sl-dialog class="nx-snapshots-error">
        <div class="nx-dialog">
          <div class="nx-dialog-header-area">
            <p class="sl-heading-l">${this.details?.heading}</p>
            <button
              class="nx-dialog-close-btn"
              @click=${this.handleAction}
              aria-label="Close dialog">
              <svg class="icon"><use href="#S2IconClose20N-icon"/></svg>
            </button>
          </div>
          <hr/>
          <div class="nx-dialog-content-area">
            <p class="sl-body-s">${this.details?.message}</p>
          </div>
          <div class="nx-dialog-action-group">
            <sl-button @click=${this.handleAction}>OK</sl-button>
          </div>
        </div>
      </sl-dialog>
    `;
  }
}

customElements.define('nx-dialog', NxDialog);
