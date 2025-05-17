/**
 * A custom HTML element that allows users to select a musical mode.
 *
 * Features:
 * - Displays a button that, when clicked, opens a dialog.
 * - The dialog shows all diatonic modes.
 * - Supports toggling "more info" for each mode.
 * - Dispatches a custom event ('mode-selected') when a mode is selected.
 * - Exposes 'selectedModeName' and 'selectedModeData' properties.
 * - Supports setting the selected mode via the 'selected-mode-name' attribute.
 *
 * @module mode-selector
 */

import {
  type DiatonicModeName,
  diatonicModes,
  type NoteSequenceTheme,
} from "@musodojo/music-theory-data";

const modeSelectorTemplate = document.createElement("template");
modeSelectorTemplate.innerHTML = /* HTML */ `
  <style>
    :host {
      display: inline-block;
      font-size: inherit;
    }

    button {
      font: inherit;
      margin: 0;
      padding: 0;
      cursor: pointer;
      background: none;
      border-radius: 0.5em;
      border-width: 0.1em;
      border-style: solid;
      border-color: currentColor;
    }

    #mode-selector-button {
      padding-inline: 0.5em;
    }

    dialog {
      padding: 0.5em;
    }

    dialog::backdrop {
      background: rgba(0, 0, 0, 0.5);
    }

    #close-dialog-button {
      display: block;
      padding: 0.1em 0.5em;
      border: none;
      margin-inline-start: auto;
    }

    #modes-container {
      display: grid;
      grid-template-columns: auto;
      gap: 0.5em;
      padding: 0.5em;
    }

    .mode-option {
      padding: 0.5em;
      border: 1px solid #ccc;
      border-radius: 0.3em;
      cursor: pointer;
    }

    .mode-option h3 {
      margin-top: 0;
      margin-bottom: 0.2em;
    }

    .more-info {
      text-align: left;
      font-size: 0.8em;
      margin-top: 0.5em;
      padding: 0.3em;
      border-top: 1px solid #eee;
    }

    .hidden {
      display: none;
    }
  </style>

  <button id="mode-selector-button">Select Mode</button>

  <dialog id="mode-selector-dialog">
    <button id="close-dialog-button">×</button>
    <label>
      <input type="checkbox" id="toggle-more-info" />
      More Info
    </label>
    <div id="modes-container"></div>
  </dialog>
`;

interface ModeSelectedEventDetail {
  modeName: DiatonicModeName | null;
  modeData: NoteSequenceTheme | null;
}

class ModeSelector extends HTMLElement {
  #shadowRoot: ShadowRoot;
  #modeSelectorButton: HTMLButtonElement | null = null;
  #modeSelectorDialog: HTMLDialogElement | null = null;
  #modesContainer: HTMLDivElement | null = null;
  #toggleMoreInfoCheckbox: HTMLInputElement | null = null;
  #abortController: AbortController | null = null;
  #selectedModeName: DiatonicModeName | null = null;
  #selectedModeData: NoteSequenceTheme | null = null;

  static get observedAttributes(): string[] {
    return ["selected-mode-name"];
  }

  constructor() {
    super();
    this.#shadowRoot = this.attachShadow({ mode: "open" });
    this.#shadowRoot.appendChild(modeSelectorTemplate.content.cloneNode(true));

    this.#modeSelectorButton =
      this.#shadowRoot.querySelector<HTMLButtonElement>(
        "#mode-selector-button"
      );
    this.#modeSelectorDialog =
      this.#shadowRoot.querySelector<HTMLDialogElement>(
        "#mode-selector-dialog"
      );
    this.#modesContainer =
      this.#shadowRoot.querySelector<HTMLDivElement>("#modes-container");
    this.#toggleMoreInfoCheckbox =
      this.#shadowRoot.querySelector<HTMLInputElement>("#toggle-more-info");
  }

  connectedCallback() {
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    if (
      this.#modeSelectorButton &&
      this.#modeSelectorDialog &&
      this.#modesContainer &&
      this.#toggleMoreInfoCheckbox
    ) {
      this.#modeSelectorButton.addEventListener(
        "click",
        () => {
          this.#modeSelectorDialog!.showModal();
        },
        { signal }
      );

      const closeDialogButton = this.#shadowRoot.getElementById(
        "close-dialog-button"
      ) as HTMLButtonElement;
      closeDialogButton.addEventListener(
        "click",
        () => {
          this.#modeSelectorDialog!.close();
        },
        { signal }
      );

      this.#populateModes();

      this.#toggleMoreInfoCheckbox.addEventListener(
        "change",
        () => {
          this.#updateMoreInfoVisibility();
        },
        { signal }
      );

      this.#updateModeSelectorButtonText();
      this.#updateSelectedModeAttribute();
    } else {
      console.error("Failed to find necessary elements in the shadow DOM");
    }
  }

  disconnectedCallback() {
    this.#abortController?.abort();
  }

  attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ) {
    if (oldValue === newValue) return;
    if (name === "selected-mode-name") {
      this.selectedModeName = newValue as DiatonicModeName | null;
    }
  }

  #populateModes() {
    if (!this.#modesContainer) return;
    this.#modesContainer.innerHTML = ""; // Clear existing content

    for (const modeName in diatonicModes) {
      const modeData = diatonicModes[modeName as DiatonicModeName];
      const modeOption = document.createElement("div");
      modeOption.classList.add("mode-option");
      modeOption.innerHTML = /* HTML */ ` <h3>${modeData.primaryName}</h3> `;

      const moreInfoDiv = document.createElement("div");
      moreInfoDiv.classList.add("more-info", "hidden"); // Initially hidden
      moreInfoDiv.innerHTML = this.#renderMoreInfo(modeData);
      modeOption.appendChild(moreInfoDiv);

      modeOption.addEventListener("click", () => {
        this.#selectedModeName = modeName as DiatonicModeName;
        this.#selectedModeData = modeData;
        this.#updateModeSelectorButtonText();
        this.#updateSelectedModeAttribute();
        this.#dispatchModeSelectedEvent();
        this.#modeSelectorDialog!.close();
      });

      this.#modesContainer.appendChild(modeOption);
    }
  }

  #renderMoreInfo(modeData: NoteSequenceTheme): string {
    return /* HTML */ `
      <div><strong>Names:</strong> ${modeData.names.join(", ")}</div>
      <div><strong>Type:</strong> ${modeData.type.join(", ")}</div>
      <div>
        <strong>Characteristics:</strong> ${modeData.characteristics.join(", ")}
      </div>
      <div>
        <strong>Pattern:</strong> ${modeData.pattern.join("-")}
        (${modeData.patternShort.join("-")})
      </div>
      <div><strong>Degrees:</strong> ${modeData.degrees.join(", ")}</div>
      <div>
        <strong>Example Notes:</strong> ${modeData.exampleNotes.join(", ")}
      </div>
    `;
  }

  #updateMoreInfoVisibility() {
    const moreInfoElements = this.#shadowRoot?.querySelectorAll(
      ".more-info"
    ) as NodeListOf<HTMLDivElement>;
    moreInfoElements.forEach((el) => {
      el.classList.toggle("hidden", !this.#toggleMoreInfoCheckbox!.checked);
    });
  }

  #updateModeSelectorButtonText() {
    this.#modeSelectorButton!.textContent = this.#selectedModeData
      ? this.#selectedModeData.primaryName
      : "Select Mode";
  }

  #updateSelectedModeAttribute() {
    if (this.#selectedModeName) {
      this.setAttribute("selected-mode-name", this.#selectedModeName);
    } else {
      this.removeAttribute("selected-mode-name");
    }
  }

  #dispatchModeSelectedEvent() {
    this.dispatchEvent(
      new CustomEvent<ModeSelectedEventDetail>("mode-selected", {
        detail: {
          modeName: this.#selectedModeName,
          modeData: this.#selectedModeData,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  get selectedModeName(): DiatonicModeName | null {
    return this.#selectedModeName;
  }

  set selectedModeName(newModeName: DiatonicModeName | null) {
    this.#selectedModeName = newModeName;
    this.#selectedModeData = newModeName ? diatonicModes[newModeName] : null;
    this.#updateModeSelectorButtonText();
    this.#updateSelectedModeAttribute();
  }

  get selectedModeData(): NoteSequenceTheme | null {
    return this.#selectedModeData;
  }
}

customElements.define("mode-selector", ModeSelector);
