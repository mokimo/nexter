import { expect } from '@esm-bundle/chai';
import { readFile } from '@web/test-runner-commands';
import { diffHtml, addIds, normalizeHTML, getBlockMap2 } from '../../nx/blocks/locfour/htmldiff/htmldiff.js';

function cleanHtmlWhitespace(html) {
  return normalizeHTML(html).replace(/\s+/g, ' ').trim();
}

describe('Regional diff', () => {
  it('Returns html with differences annotated', async () => {
    const original = document.implementation.createHTMLDocument();
    original.body.innerHTML = await readFile({ path: './mocks/lang-content.html' });
    const modified = document.implementation.createHTMLDocument();
    modified.body.innerHTML = await readFile({ path: './mocks/regional-content.html' });
    const mainEl = await diffHtml(original, modified);
    const expectedDiffedMain = await readFile({ path: './mocks/diffedMain.html' });
    expect(cleanHtmlWhitespace(mainEl.outerHTML)).to.equal(cleanHtmlWhitespace(expectedDiffedMain));
  });

  it('WIP: Basic Html diff', async () => {
    const original = document.implementation.createHTMLDocument();
    original.body.innerHTML = await readFile({ path: './mocks/source.html' });
    const modified = document.implementation.createHTMLDocument();
    modified.body.innerHTML = await readFile({ path: './mocks/destination.html' });
    const mainEl = await diffHtml(original, modified);
    const expectedDiffedMain = await readFile({ path: './expected/diff.html' });
    expect(cleanHtmlWhitespace(mainEl.outerHTML)).to.equal(cleanHtmlWhitespace(expectedDiffedMain));
  });

  it('WIP: Adds IDs', async () => {
    const original = document.implementation.createHTMLDocument();
    original.body.innerHTML = await readFile({ path: './mocks/source.html' });
    // const modified = document.implementation.createHTMLDocument();
    // modified.body.innerHTML = await readFile({ path: './mocks/destination.html' });
    addIds(original);
    const expected = await readFile({ path: './expected/ids.html' });
    expect(cleanHtmlWhitespace(original.body.innerHTML)).to.equal(cleanHtmlWhitespace(expected));
  });

  // it.only('WIP: Basic Html diff', async () => {
  //   const original = document.implementation.createHTMLDocument();
  //   original.body.innerHTML = await readFile({ path: './mocks/sample.html' });
  //   const modified = document.implementation.createHTMLDocument();
  //   modified.body.innerHTML = await readFile({ path: './mocks/destination.html' });
  //   // const mainEl = await diffHtml(original, modified);
  //   const blockMap = getBlockMap2(original);
  //   const expectedDiffedMain = await readFile({ path: './expected/diff.html' });
  //   expect(cleanHtmlWhitespace(mainEl.outerHTML)).to.equal(cleanHtmlWhitespace(expectedDiffedMain));
  // });
});
