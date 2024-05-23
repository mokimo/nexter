import { readFile } from '@web/test-runner-commands';
import { expect } from '@esm-bundle/chai';
import { regionalDiff, removeLocTags } from '../../../../../nx/blocks/loc/regional-diff/regional-diff.js';

const getHtml = async (path) => {
  const html = await readFile({ path });
  return new DOMParser().parseFromString(html, 'text/html');
};

describe('regionalDiff', () => {
  it('should not change the modified document if langstore and modified are identical ', async () => {
    const langstore = await getHtml('./mocks/langstore-1.html');
    const modified = await getHtml('./mocks/langstore-1.html');
    await regionalDiff(langstore, modified);

    expect(langstore.documentElement.outerHTML)
      .to.equal(modified.documentElement.outerHTML);
  });


  it('should annotate the modified document with changes', async () => {
    const langstore = await getHtml('./mocks/langstore-1.html');
    const modified = await getHtml('./mocks/regional-edit-1.html');

    await regionalDiff(langstore, modified);

    expect(modified.body.querySelector('da-metadata')).to.exist;
    expect(modified.body.querySelectorAll('da-content-current').length).to.equal(2);

    const hash1 = 'da-content-source[data-obj-hash="3a8a6504dc9c4da298d85a809bda4acd3f01a311"]';
    const hash2 = 'da-content-source[data-obj-hash="53bc6a78889ee9ba9f366ae9209880a5c70a84e5"]';

    const mainSourceHash1 = modified.body.querySelector(`main ${hash1}`);
    expect(mainSourceHash1.childElementCount).to.equal(0);
    const mainSourceHash2 = modified.body.querySelector(`main ${hash2}`);
    expect(mainSourceHash2.childElementCount).to.equal(0);

    const daMetadataSourceHash1 = modified.body.querySelector(`da-metadata ${hash1}`);
    expect(daMetadataSourceHash1.childElementCount).to.equal(1);
    expect(daMetadataSourceHash1.firstChild.classList.contains('marquee')).to.be.true;

    const daMetadataSourceHash2 = modified.body.querySelector(`da-metadata ${hash2}`);
    expect(daMetadataSourceHash2.childElementCount).to.equal(1);
    expect(daMetadataSourceHash2.firstChild.nodeName).to.equal('P');
  });

  it('should consider changes within a block group as one change', async () => {
    const langstore = await getHtml('./mocks/langstore-blockgroup.html');
    const modified = await getHtml('./mocks/regional-edit-blockgroup.html');

    await regionalDiff(langstore, modified);

    const hash = 'da-content-source[data-obj-hash="5afff1725869ae8159a5d3f801ae104f83023a39"]';

    const mainSourceHash1 = modified.body.querySelector(`main ${hash}`);
    expect(mainSourceHash1.childElementCount).to.equal(0);

    expect(modified.body.querySelector('da-metadata')).to.exist;
    const daMetadataSourceHash1 = modified.body.querySelector(`da-metadata ${hash}`);
    expect(daMetadataSourceHash1.childElementCount).to.equal(4);
    expect(modified.body.querySelectorAll('da-content-current').length).to.equal(1);
  });

  it('should not add a da-metadata el if there are only additions to the regional doc', async () => {
    const langstore = await getHtml('./mocks/langstore-1.html');
    const modified = await getHtml('./mocks/regional-1-only-additions.html');

    await regionalDiff(langstore, modified);
    expect(modified.body.querySelector('da-metadata')).not.to.exist;
    expect(modified.body.querySelectorAll('da-content-current').length).to.equal(2);
  });

  it('should show list changes on a line by line basis', async () => {
    const langstore = await getHtml('./mocks/langstore-list.html');
    const modified = await getHtml('./mocks/regional-list.html');

    await regionalDiff(langstore, modified);
    expect(modified.body.querySelectorAll('da-content-current').length).to.equal(4);
    expect(modified.body.querySelector('da-metadata')).to.exist;

    // only checking one list item
    const listItemHash = 'da-content-source[data-obj-hash="bd65bf0d10c3041961ac14741430743616ed5986"]';
    expect(modified.body.querySelector(`da-metadata ${listItemHash}`)).to.exist;
    expect(modified.body.querySelector(`main ${listItemHash}`)).to.exist;
    expect(modified.body.querySelector(`main ${listItemHash}`).parentElement.nodeName).to.equal('LI');
  });
});
