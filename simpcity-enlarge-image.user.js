// ==UserScript==
// @name         SimpCity Enlarge Image
// @namespace    https://github.com/vylix-dev/simpcity-enlarge-image
// @version      1.0.0
// @description  Expand embedded SimpCity thumbnail images inline instead of opening external image links.
// @author       vylix-dev
// @license      MIT
// @icon         https://raw.githubusercontent.com/vylix-dev/simpcity-enlarge-image/main/vylix-logo-64.png
// @iconURL      https://raw.githubusercontent.com/vylix-dev/simpcity-enlarge-image/main/vylix-logo-64.png
// @icon64       https://raw.githubusercontent.com/vylix-dev/simpcity-enlarge-image/main/vylix-logo-128.png
// @icon64URL    https://raw.githubusercontent.com/vylix-dev/simpcity-enlarge-image/main/vylix-logo-128.png
// @homepageURL  https://github.com/vylix-dev/simpcity-enlarge-image
// @supportURL   https://github.com/vylix-dev/simpcity-enlarge-image/issues
// @updateURL    https://raw.githubusercontent.com/vylix-dev/simpcity-enlarge-image/main/simpcity-enlarge-image.meta.js
// @downloadURL  https://raw.githubusercontent.com/vylix-dev/simpcity-enlarge-image/main/simpcity-enlarge-image.user.js
// @match        *://simpcity.cr/*
// @match        *://www.simpcity.cr/*
// @match        *://*.simpcity.cr/*
// @run-at       document-idle
// @grant        none
// @noframes
// ==/UserScript==

(() => {
  'use strict';

  const APP = Object.freeze({
    id: 'scie',
    name: 'SimpCity Enlarge Image',
  });

  const IMAGE_SELECTOR = 'img.bbImage';
  const IMAGE_URL_PATTERN = /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i;
  const THUMBNAIL_URL_PATTERN = /\.(?:md|th)\.(avif|gif|jpe?g|png|webp)(?=($|[?#]))/i;

  const CSS = String.raw`
    img.bbImage.scie-image {
      cursor: zoom-in !important;
    }

    a.scie-link {
      cursor: zoom-in !important;
    }

    img.bbImage.scie-expanded {
      display: block !important;
      max-width: min(100%, 1200px) !important;
      max-height: 90vh !important;
      width: auto !important;
      height: auto !important;
      margin: 10px auto !important;
      object-fit: contain !important;
      cursor: zoom-out !important;
      background: #050505 !important;
      box-shadow:
        0 0 0 1px rgba(255, 85, 85, 0.48),
        0 0 0 4px rgba(0, 0, 0, 0.45) !important;
    }

    a.scie-link:has(img.scie-expanded) {
      display: block !important;
      max-width: 100% !important;
      cursor: zoom-out !important;
    }
  `;

  function injectStyles() {
    if (document.getElementById(`${APP.id}-styles`)) return;

    const style = document.createElement('style');
    style.id = `${APP.id}-styles`;
    style.textContent = CSS;
    document.head.append(style);
  }

  function cleanThumbnailName(value) {
    return String(value || '').replace(/\.(?:md|th)(?=\.(?:avif|gif|jpe?g|png|webp)(?:$|[?#]))/i, '');
  }

  function getLargeImageUrl(value) {
    return String(value || '').replace(THUMBNAIL_URL_PATTERN, '.$1');
  }

  function imageUrlFromAnchor(img) {
    const anchor = img.closest('a[href]');
    if (!anchor) return '';

    const href = anchor.href || anchor.getAttribute('href') || '';
    return IMAGE_URL_PATTERN.test(href) ? href : '';
  }

  function getExpandableUrl(img) {
    const thumbnailUrl = img.dataset.scieThumbSrc || img.currentSrc || img.src || '';
    const largeUrl = getLargeImageUrl(thumbnailUrl);

    if (largeUrl && largeUrl !== thumbnailUrl) return largeUrl;
    return imageUrlFromAnchor(img);
  }

  function rememberOriginalImageState(img) {
    if (!img.dataset.scieThumbSrc) img.dataset.scieThumbSrc = img.currentSrc || img.src || '';
    if (!img.dataset.scieThumbSrcset && img.getAttribute('srcset')) img.dataset.scieThumbSrcset = img.getAttribute('srcset') || '';
    if (!img.dataset.scieThumbSizes && img.getAttribute('sizes')) img.dataset.scieThumbSizes = img.getAttribute('sizes') || '';
  }

  function prepareImage(img) {
    if (!(img instanceof HTMLImageElement)) return;

    rememberOriginalImageState(img);
    const largeUrl = getExpandableUrl(img);
    if (!largeUrl) return;

    img.dataset.scieLargeSrc = largeUrl;
    img.classList.add('scie-image');

    if (img.title) img.title = cleanThumbnailName(img.title);
    if (img.alt) img.alt = cleanThumbnailName(img.alt);

    const anchor = img.closest('a[href]');
    if (anchor) {
      anchor.classList.add('scie-link');
      if (!anchor.dataset.scieOriginalHref) anchor.dataset.scieOriginalHref = anchor.getAttribute('href') || '';
      anchor.setAttribute('aria-label', `${APP.name}: click to expand image inline`);
    }
  }

  function scan(root = document.body) {
    if (!root) return;

    if (root instanceof HTMLImageElement && root.matches(IMAGE_SELECTOR)) {
      prepareImage(root);
    }

    if (root.querySelectorAll) {
      root.querySelectorAll(IMAGE_SELECTOR).forEach(prepareImage);
    }
  }

  function restoreThumbnail(img) {
    const thumbSrc = img.dataset.scieThumbSrc;
    if (thumbSrc) img.src = thumbSrc;

    if (img.dataset.scieThumbSrcset) {
      img.setAttribute('srcset', img.dataset.scieThumbSrcset);
    }

    if (img.dataset.scieThumbSizes) {
      img.setAttribute('sizes', img.dataset.scieThumbSizes);
    }
  }

  function expandImage(img) {
    const largeUrl = img.dataset.scieLargeSrc || getExpandableUrl(img);
    if (!largeUrl) return;

    rememberOriginalImageState(img);
    img.dataset.scieLargeSrc = largeUrl;
    img.classList.add('scie-expanded');
    img.dataset.scieExpanded = 'true';
    img.src = largeUrl;
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
    img.title = 'Click to collapse image';
  }

  function collapseImage(img) {
    img.classList.remove('scie-expanded');
    delete img.dataset.scieExpanded;
    restoreThumbnail(img);
    img.title = 'Click to expand image inline';
  }

  function toggleImage(img) {
    if (!img.classList.contains('scie-image')) prepareImage(img);
    if (!img.dataset.scieLargeSrc) return;

    if (img.classList.contains('scie-expanded')) {
      collapseImage(img);
    } else {
      expandImage(img);
    }
  }

  function imageFromEventTarget(target) {
    if (!(target instanceof Element)) return null;

    const directImage = target.closest(IMAGE_SELECTOR);
    if (directImage instanceof HTMLImageElement) return directImage;

    const anchor = target.closest('a.scie-link');
    const linkedImage = anchor ? anchor.querySelector(IMAGE_SELECTOR) : null;
    return linkedImage instanceof HTMLImageElement ? linkedImage : null;
  }

  function handleImageClick(event) {
    const img = imageFromEventTarget(event.target);
    if (!img) return;

    prepareImage(img);
    if (!img.dataset.scieLargeSrc) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    toggleImage(img);
  }

  function observeThreadContent() {
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        scan();
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  injectStyles();
  scan();
  document.addEventListener('click', handleImageClick, true);
  document.addEventListener('auxclick', handleImageClick, true);
  observeThreadContent();
})();
