/* global objectHash */

// eslint-disable-next-line import/no-unresolved
import './object_hash.js';

// CURRENT = the current file aka the regional edit
// SOURCE = the source file aka the langstore file

const MIN_LIST_ITEMS_IN_COMMON = 2;
const CURRENT = 'current';
const CURRENT_TAG = 'da-content-current';
const DA_METADATA_TAG = 'da-metadata';
const SOURCE = 'source';
const SOURCE_TAG = 'da-content-source';
const SAME = 'same';

const sectionBlock = {
  isSection: true,
  outerHTML: 'spoofedSectionHtml',
};

const isList = (block) => ['OL', 'UL'].includes(block.nodeName);

function getLists(result) {
  const currentLists = [];
  const sourceLists = [];
  result.forEach((item) => {
    if (item.type === CURRENT && isList(item.block)) {
      currentLists.push(item);
    }
    if (item.type === SOURCE && isList(item.block)) {
      sourceLists.push(item);
    }
  });
  return [currentLists, sourceLists];
}

function getListHashes(list) {
  return [...list.children].map((child) => {
    child.hash = objectHash(child.outerHTML);
    return child.hash;
  });
}

const listElToBlockMap = (listItems) => [...listItems].map((item) => ({
  hash: item.hash,
  block: item,
}));

function wrapContentWithElement(targetElement, wrapperElementTag) {
  const wrapperElement = document.createElement(wrapperElementTag);
  while (targetElement.firstChild) {
    wrapperElement.appendChild(targetElement.firstChild);
  }
  targetElement.appendChild(wrapperElement);
}

const convertToHtmlList = (mergedList, daMetadataEl) => mergedList
  .map((item) => {
    if (item.type === CURRENT) {
      // LI's have the inner content wrapped, unlike other els that are wrapped outside
      wrapContentWithElement(item.block, CURRENT_TAG);
    } else if (item.type === SOURCE) {
      addSourceTagToMetadata(daMetadataEl, item.hash, item.block.outerHTML);
      item.block.innerHTML = `<${SOURCE_TAG} data-obj-hash="${item.hash}"></${SOURCE_TAG}>`;
    }
    return item.block.outerHTML;
  }).join('');

function checkLists(res, daMetadataEl) {
  let result = res;
  const [currentLists, sourceLists] = getLists(result);
  // see if any of the added lists children match with any deleted list children
  currentLists.forEach((currentList) => {
    const addedItemHashes = getListHashes(currentList.block);
    sourceLists.forEach((sourceList) => {
      if (currentList.block.nodeName !== sourceList.block.nodeName) {
        return;
      }
      const deletedItemHashes = getListHashes(sourceList.block);
      const commonHashes = addedItemHashes.filter((hash) => deletedItemHashes.includes(hash));

      if (commonHashes.length >= MIN_LIST_ITEMS_IN_COMMON) {
        // lists have 2+ common listItems, so we assume that the langstore list has been modified

        // remove the deleted list
        result = result.filter((item) => item.hash !== sourceList.hash);

        const currentListItems = listElToBlockMap(currentList.block.children);
        const sourceListItems = listElToBlockMap(sourceList.block.children);

        // eslint-disable-next-line no-use-before-define
        // const mergedList = blockDiff(currentListItems, sourceListItems, daMetadataEl, true);
        const mergedList = blockDiff(sourceListItems, currentListItems, daMetadataEl, true);
        currentList.block.innerHTML = convertToHtmlList(mergedList, daMetadataEl);
        currentList.type = SAME;
      }
    });
  });
  return result;
}

function addToResult(result, newItem, type) {
  for (let i = 0; i < result.length; i += 1) {
    const resultItem = result[i];
    if (resultItem.hash !== newItem.hash || resultItem.type === SAME) {
      // eslint-disable-next-line no-continue
      continue;
    }
    if (resultItem.type === SOURCE) {
      if (type === CURRENT) {
        // remove the deleted item from the result, since it was moved
        return [...result.slice(0, i), ...result.slice(i + 1), { ...newItem, type: SAME }];
      }
      if (type === SOURCE) {
        // item was deleted in both arrays
        return [...result, { ...newItem, type: SOURCE }];
      }
    }
    if (resultItem.type === CURRENT) {
      if (type === CURRENT) {
        // item was added in both arrays
        return [...result, { ...newItem, type: CURRENT }];
      }
      if (type === SOURCE) {
        resultItem.type = SAME;
        return result;
      }
    }
  }
  result.push({ ...newItem, type });
  return result;
}

function blockDiff(A, B, daMetadataEl, isListCheck = false) {
  let result = [];
  const length = Math.min(A.length, B.length);
  let i = 0;
  for (i; i < length; i += 1) {
    if (A[i].hash === B[i].hash) {
      result = addToResult(result, A[i], SAME);
    } else {
      result = addToResult(result, A[i], SOURCE);
      result = addToResult(result, B[i], CURRENT);
    }
  }

  // Add any remaining items
  if (i < A.length) {
    for (; i < A.length; i += 1) {
      result = addToResult(result, A[i], SOURCE);
    }
  }
  if (i < B.length) {
    for (; i < B.length; i += 1) {
      result = addToResult(result, B[i], CURRENT);
    }
  }

  if (!isListCheck) {
    result = checkLists(result, daMetadataEl);
  }

  return result;
}

function groupBlocks(blocks) {
  const { groupedBlocks, currentGroup } = blocks.reduce((acc, block) => {
    if (block.className?.toLowerCase().startsWith('block-group-start')) {
      acc.isGrouping = true;
      acc.currentGroup.push(block);
    } else if (block.className?.toLowerCase().startsWith('block-group-end')) {
      acc.currentGroup.push(block);
      acc.groupedBlocks.push(acc.currentGroup);
      acc.currentGroup = [];
      acc.isGrouping = false;
    } else if (acc.isGrouping) {
      acc.currentGroup.push(block);
    } else {
      acc.groupedBlocks.push(block);
    }
    return acc;
  }, { groupedBlocks: [], currentGroup: [], isGrouping: false });

  if (currentGroup.length > 0) {
    groupedBlocks.push(currentGroup);
  }

  return groupedBlocks;
}

function blockGroupToStr(blockGroup) {
  return blockGroup.reduce((str, block) => {
    // eslint-disable-next-line no-param-reassign
    str += block.outerHTML || '';
    return str;
  }, '');
}

const isNotEmptyParagraphEl = (el) => !(el.nodeName === 'P' && !el.childNodes.length && el.textContent === '');

function getBlockMap(dom) {
  const sections = [...dom.querySelectorAll('main > div')];

  // flatten sections so that they are just dividers between blocks
  let blocks = sections.reduce((acc, section) => {
    const sectionBlocks = [...section.children]
      .filter(isNotEmptyParagraphEl);
    const sectionArr = acc.length ? [sectionBlock] : [];
    return [...acc, ...sectionArr, ...sectionBlocks];
  }, []);

  blocks = groupBlocks(blocks);

  return blocks.map((block) => {
    const stringToHash = block.outerHTML || blockGroupToStr(block);
    const hash = objectHash(stringToHash);
    return { block, hash };
  });
}

function htmldiff(sourceDOM, currentDOM, daMetadataEl) {
  const sourceBlockMap = getBlockMap(sourceDOM);
  const currentBlockMap = getBlockMap(currentDOM);
  const diff = blockDiff(sourceBlockMap, currentBlockMap, daMetadataEl, false);
  return diff;
}

function wrapElement(targetElement, wrapperElementTag) {
  const wrapperElement = document.createElement(wrapperElementTag);
  wrapperElement.appendChild(targetElement);
  return wrapperElement;
}

function getGroupInnerHtml(blockGroup) {
  let htmlText = '';
  blockGroup.forEach((block) => {
    if (block.isSection) {
      htmlText += '</div><div>';
      return;
    }
    htmlText += block.outerHTML;
  });
  return htmlText;
}

function addSourceTagToMetadata(daMetadataEl, hash, htmlStr) {
  const sourceEl = document.createElement(SOURCE_TAG);
  sourceEl.dataset.objHash = hash;
  sourceEl.innerHTML = htmlStr;
  daMetadataEl.appendChild(sourceEl);
}

function getBlockgroupHtml(item, daMetadataEl) {
  // Modified block groups automatically get sections at start and end
  const htmlText = getGroupInnerHtml(item.block);

  if (item.type === CURRENT) {
    return `<${CURRENT_TAG} class="da-group"><div>${htmlText}</div></${CURRENT_TAG}>`;
  }
  if (item.type === SOURCE) {
    addSourceTagToMetadata(daMetadataEl, item.hash, `<div>${htmlText}</div>`);
    return `<${SOURCE_TAG} class="da-group" data-obj-hash="${item.hash}"></${SOURCE_TAG}>`;
  }
  return htmlText;
}

function updateModifiedWithDiff(diff, modified, daMetadataEl) {
  let htmlText = '<div>';
  diff.forEach((item, i) => {
    let modifiedBlock = item.block;
    if (item.block.isSection && i !== 0) {
      htmlText += '</div><div>';
      return;
    }

    if (Array.isArray(item.block)) {
      htmlText += getBlockgroupHtml(item, daMetadataEl);
      return;
    }

    if (item.type === CURRENT) {
      modifiedBlock = wrapElement(item.block, CURRENT_TAG);
    } else if (item.type === SOURCE) {
      modifiedBlock = `<${SOURCE_TAG} data-obj-hash="${item.hash}"></${SOURCE_TAG}>`;
      addSourceTagToMetadata(daMetadataEl, item.hash, item.block.outerHTML);
    }
    htmlText += modifiedBlock.outerHTML || modifiedBlock;
  });
  htmlText += '</div>';

  modified.documentElement.querySelector('main').innerHTML = htmlText;
}

export const isIdenticalHtml = (html1, html2) => {
  const getOuterHtml = (el) => el.documentElement.outerHTML.replace(/\s/g, '');
  return getOuterHtml(html1) === getOuterHtml(html2);
}

export const removeLocTags = (html) => {
  // TODO rename tags
  const locElsToRemove = html.querySelectorAll(`${SOURCE_TAG}, [loc-temp-dom]`);
  locElsToRemove.forEach((el) => el.remove());

  const tags = html.querySelectorAll('da-content-current');

  // Iterate over each tag
  tags.forEach((tag) => {
    while (tag.firstChild) {
      tag.parentNode.insertBefore(tag.firstChild, tag);
    }
    tag.parentNode.removeChild(tag);
  });
};

export async function regionalDiff(original, modified) {
  if (isIdenticalHtml(original, modified)) {
    return;
  }

  let daMetadataEl = modified.querySelector(DA_METADATA_TAG);
  if (!daMetadataEl) {
    daMetadataEl = document.createElement(DA_METADATA_TAG);
    modified.body.appendChild(daMetadataEl);
  }

  const diff = htmldiff(original, modified, daMetadataEl);
  updateModifiedWithDiff(diff, modified, daMetadataEl);

  if (daMetadataEl.children.length === 0) {
    daMetadataEl.remove();
  }
}
