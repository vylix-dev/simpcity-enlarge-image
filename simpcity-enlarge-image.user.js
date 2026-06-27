// ==UserScript==
// @name         SimpCity Enlarge Image
// @namespace    https://github.com/vylix-dev/simpcity-enlarge-image
// @version      1.0.1
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
  const PIXHOST_THUMBNAIL_URL_PATTERN = /^https?:\/\/t(\d+)\.pixhost\.to\/thumbs\/([^/]+)\/([^?#]+)([?#].*)?$/i;
  const COLLAPSE_ANIMATION_MS = 150;
  const collapseTimers = new WeakMap();

  const CSS = String.raw`
    @keyframes scie-expand-image {
      from {
        opacity: 0.72;
        transform: scale(0.965);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes scie-collapse-image {
      from {
        opacity: 1;
        transform: scale(1);
      }
      to {
        opacity: 0.72;
        transform: scale(0.965);
      }
    }

    img.bbImage.scie-image {
      cursor: zoom-in !important;
      transform-origin: center center !important;
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
      box-shadow: none !important;
      animation: scie-expand-image 180ms cubic-bezier(0.22, 1, 0.36, 1) both !important;
    }

    img.bbImage.scie-collapsing {
      animation: scie-collapse-image 150ms cubic-bezier(0.55, 0, 1, 0.45) both !important;
    }

    a.scie-link:has(img.scie-expanded) {
      display: block !important;
      max-width: 100% !important;
      cursor: zoom-out !important;
    }

    @media (prefers-reduced-motion: reduce) {
      img.bbImage.scie-expanded,
      img.bbImage.scie-collapsing {
        animation: none !important;
      }
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

  function getPixhostLargeImageUrl(value) {
    const match = String(value || '').match(PIXHOST_THUMBNAIL_URL_PATTERN);
    if (!match) return '';

    const [, shard, folder, fileName, suffix = ''] = match;
    return `https://img${shard}.pixhost.to/images/${folder}/${fileName}${suffix}`;
  }

  function getLargeImageUrl(value) {
    const url = String(value || '');
    const pixhostUrl = getPixhostLargeImageUrl(url);
    if (pixhostUrl) return pixhostUrl;

    return url.replace(THUMBNAIL_URL_PATTERN, '.$1');
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

    const anchorImageUrl = imageUrlFromAnchor(img);
    if (anchorImageUrl) return anchorImageUrl;

    return IMAGE_URL_PATTERN.test(thumbnailUrl) ? thumbnailUrl : '';
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
    const collapseTimer = collapseTimers.get(img);
    if (collapseTimer) {
      window.clearTimeout(collapseTimer);
      collapseTimers.delete(img);
    }

    const largeUrl = img.dataset.scieLargeSrc || getExpandableUrl(img);
    if (!largeUrl) return;

    rememberOriginalImageState(img);
    img.dataset.scieLargeSrc = largeUrl;
    img.classList.remove('scie-collapsing');
    img.classList.add('scie-expanded');
    img.dataset.scieExpanded = 'true';
    img.src = largeUrl;
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
    img.title = 'Click to collapse image';
  }

  function collapseImage(img) {
    if (collapseTimers.has(img)) return;

    img.classList.add('scie-collapsing');
    const timer = window.setTimeout(() => {
      img.classList.remove('scie-expanded', 'scie-collapsing');
      delete img.dataset.scieExpanded;
      restoreThumbnail(img);
      img.title = 'Click to expand image inline';
      collapseTimers.delete(img);
    }, COLLAPSE_ANIMATION_MS);

    collapseTimers.set(img, timer);
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
