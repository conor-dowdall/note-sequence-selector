/**
 * A custom HTML element that allows users to select a musical note sequence.
 *
 * Features:
 * - Displays a button that, when clicked, opens a dialog.
 * - The dialog shows all available note sequences.
 * - Supports toggling "more info" for each note sequence.
 * - Dispatches a custom event ('note-sequence-selected') when a note sequence is selected.
 * - Exposes 'selectedNoteSequenceThemeKey' and 'selectedNoteSequenceTheme' properties.
 * - Supports setting the selected note sequence via the 'selected-note-sequence-theme-key' attribute.
 *
 * @module
 */

import {
  allNoteSequenceThemes,
  type NoteSequenceTheme,
  type NoteSequenceThemeGroupKey,
  noteSequenceThemeGroupsMetadata,
  type NoteSequenceThemeKey,
  noteSequenceThemes,
} from "@musodojo/music-theory-data";

const noteSequenceSelectorTemplate = document.createElement("template");
noteSequenceSelectorTemplate.innerHTML = /* HTML */ `
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

    #note-sequence-selector-button {
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
      font-size: 2em;
      padding: 0em 0.5em;
      border: none;
      margin-inline-start: auto;
    }

    #note-sequences-container {
      display: flex;
      flex-direction: column;
      gap: 1em;
      margin-block-start: 2em;
    }

    #group-wrapper {
      > h3 {
        margin: 0em;
      }
    }

    #group-note-sequences-wrapper {
      margin-block: 0.5em;
      display: flex;
      flex-wrap: wrap;
      gap: 1em;
    }

    .note-sequence-option {
      padding: 0.5em;
      border: 0.1em solid currentColor;
      border-radius: 0.5em;
      cursor: pointer;

      > h4 {
        margin-block: 0.2em;
      }
    }

    #toggle-more-info-label {
      padding: 0.5em;
      border: 0.1em solid currentColor;
      border-radius: 0.5em;
      cursor: pointer;
    }

    .more-info-div {
      font-size: 0.9em;
    }

    .hidden {
      display: none;
    }
  </style>

  <button id="note-sequence-selector-button">Select Sequence</button>

  <dialog id="note-sequence-selector-dialog">
    <button id="close-dialog-button">×</button>
    <label id="toggle-more-info-label">
      <input type="checkbox" id="toggle-more-info-checkbox" />
      more info
    </label>
    <div id="note-sequences-container"></div>
  </dialog>
`;

interface NoteSequenceSelectedEventDetail {
  noteSequenceThemeKey: NoteSequenceThemeKey | null;
  noteSequenceTheme: NoteSequenceTheme | null;
}

class NoteSequenceSelector extends HTMLElement {
  #shadowRoot: ShadowRoot;
  #noteSequenceSelectorButton: HTMLButtonElement | null = null;
  #noteSequenceSelectorDialog: HTMLDialogElement | null = null;
  #noteSequencesContainer: HTMLDivElement | null = null;
  #toggleMoreInfoCheckbox: HTMLInputElement | null = null;
  #abortController: AbortController | null = null;
  #selectedNoteSequenceThemeKey: NoteSequenceThemeKey | null = null;
  #selectedNoteSequenceTheme: NoteSequenceTheme | null = null;

  static get observedAttributes(): string[] {
    return ["selected-note-sequence-theme-key"];
  }

  constructor() {
    super();
    this.#shadowRoot = this.attachShadow({ mode: "open" });
    this.#shadowRoot.appendChild(
      noteSequenceSelectorTemplate.content.cloneNode(true),
    );

    this.#noteSequenceSelectorButton = this.#shadowRoot.querySelector<
      HTMLButtonElement
    >(
      "#note-sequence-selector-button",
    );
    this.#noteSequenceSelectorDialog = this.#shadowRoot.querySelector<
      HTMLDialogElement
    >(
      "#note-sequence-selector-dialog",
    );
    this.#noteSequencesContainer = this.#shadowRoot.querySelector<
      HTMLDivElement
    >(
      "#note-sequences-container",
    );
    this.#toggleMoreInfoCheckbox = this.#shadowRoot.querySelector<
      HTMLInputElement
    >(
      "#toggle-more-info-checkbox",
    );
  }

  connectedCallback() {
    this.#abortController = new AbortController();
    const { signal } = this.#abortController;

    if (
      this.#noteSequenceSelectorButton &&
      this.#noteSequenceSelectorDialog &&
      this.#noteSequencesContainer &&
      this.#toggleMoreInfoCheckbox
    ) {
      this.#noteSequenceSelectorButton.addEventListener(
        "click",
        () => {
          this.#noteSequenceSelectorDialog!.showModal();
        },
        { signal },
      );

      const closeDialogButton = this.#shadowRoot.getElementById(
        "close-dialog-button",
      ) as HTMLButtonElement;
      closeDialogButton.addEventListener(
        "click",
        () => {
          this.#noteSequenceSelectorDialog!.close();
        },
        { signal },
      );

      this.#toggleMoreInfoCheckbox.addEventListener(
        "change",
        () => {
          this.#updateMoreInfoVisibility();
        },
        { signal },
      );

      this.#populateNoteSequences();
      this.#updateNoteSequenceSelectorButtonText();
      this.#updateSelectedNoteSequenceAttribute();
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
    newValue: string | null,
  ) {
    if (oldValue === newValue) return;
    if (name === "selected-note-sequence-theme-key") {
      this.selectedNoteSequenceThemeKey = newValue as
        | NoteSequenceThemeKey
        | null;
    }
  }

  #populateNoteSequences() {
    if (!this.#noteSequencesContainer) return;

    this.#noteSequencesContainer.replaceChildren();

    Object.entries(noteSequenceThemeGroupsMetadata).forEach(
      ([groupKey, groupMetadata]) => {
        const groupDiv = document.createElement("div");
        groupDiv.id = "group-wrapper";
        groupDiv.innerHTML = /* HTML */ `<h3>${groupMetadata.displayName}</h3>`;

        const groupMoreInfoDiv = document.createElement("div");
        groupMoreInfoDiv.classList.add("more-info-div", "hidden");
        groupMoreInfoDiv.textContent = `${groupMetadata.description}`;
        groupDiv.appendChild(groupMoreInfoDiv);

        const groupNoteSequencesWrapper = document.createElement("div");
        groupNoteSequencesWrapper.id = "group-note-sequences-wrapper";
        groupDiv.appendChild(groupNoteSequencesWrapper);

        const currentGroup =
          noteSequenceThemes[groupKey as NoteSequenceThemeGroupKey];

        Object.entries(currentGroup).forEach(([key, theme]) => {
          const noteSequenceDiv = document.createElement("div");
          noteSequenceDiv.classList.add("note-sequence-option");
          noteSequenceDiv.innerHTML = /* HTML */ `<h4>
            ${theme.primaryName}
          </h4>`;

          const themeMoreInfoDiv = document.createElement("div");
          themeMoreInfoDiv.classList.add("more-info-div", "hidden");
          themeMoreInfoDiv.innerHTML = this.#renderMoreInfo(theme);
          noteSequenceDiv.appendChild(themeMoreInfoDiv);

          noteSequenceDiv.addEventListener("click", () => {
            this.#selectedNoteSequenceThemeKey = key as NoteSequenceThemeKey;
            this.#selectedNoteSequenceTheme = theme;
            this.#updateNoteSequenceSelectorButtonText();
            this.#updateSelectedNoteSequenceAttribute();
            this.#dispatchNoteSequenceSelectedEvent();
            this.#noteSequenceSelectorDialog!.close();
          });

          groupNoteSequencesWrapper.appendChild(noteSequenceDiv);
        });

        this.#noteSequencesContainer!.appendChild(groupDiv);
      },
    );
  }

  #renderMoreInfo(noteSequenceTheme: NoteSequenceTheme): string {
    return /* HTML */ `
      <div>${noteSequenceTheme.names.join(", ")}</div>
      <div>${noteSequenceTheme.type.join(", ")}</div>
      <div>${noteSequenceTheme.characteristics.join(", ")}</div>
      <div>${noteSequenceTheme.pattern.join("-")}</div>
      <div>${noteSequenceTheme.patternShort.join("-")}</div>
      <div>${noteSequenceTheme.degrees.join(", ")}</div>
      <div>${noteSequenceTheme.exampleNotes.join(", ")}</div>
    `;
  }

  #updateMoreInfoVisibility() {
    const moreInfoElements = this.#shadowRoot?.querySelectorAll(
      ".more-info-div",
    ) as NodeListOf<HTMLDivElement>;
    moreInfoElements.forEach((el) => {
      el.classList.toggle("hidden", !this.#toggleMoreInfoCheckbox!.checked);
    });
  }

  #updateNoteSequenceSelectorButtonText() {
    this.#noteSequenceSelectorButton!.textContent = this
        .#selectedNoteSequenceTheme
      ? this.#selectedNoteSequenceTheme.primaryName
      : "Select Sequence";
  }

  #updateSelectedNoteSequenceAttribute() {
    if (this.#selectedNoteSequenceThemeKey) {
      this.setAttribute(
        "selected-note-sequence-theme-key",
        this.#selectedNoteSequenceThemeKey,
      );
    } else {
      this.removeAttribute("selected-note-sequence-theme-key");
    }
  }

  #dispatchNoteSequenceSelectedEvent() {
    this.dispatchEvent(
      new CustomEvent<NoteSequenceSelectedEventDetail>(
        "note-sequence-selected",
        {
          detail: {
            noteSequenceThemeKey: this.#selectedNoteSequenceThemeKey,
            noteSequenceTheme: this.#selectedNoteSequenceTheme,
          },
          bubbles: true,
          composed: true,
        },
      ),
    );
  }

  get selectedNoteSequenceThemeKey(): NoteSequenceThemeKey | null {
    return this.#selectedNoteSequenceThemeKey;
  }

  set selectedNoteSequenceThemeKey(
    newNoteSequenceThemeKey: NoteSequenceThemeKey | null,
  ) {
    this.#selectedNoteSequenceThemeKey = newNoteSequenceThemeKey;
    this.#selectedNoteSequenceTheme = newNoteSequenceThemeKey
      ? allNoteSequenceThemes[newNoteSequenceThemeKey]
      : null;
    this.#updateNoteSequenceSelectorButtonText();
    this.#updateSelectedNoteSequenceAttribute();
  }

  get selectedNoteSequenceTheme(): NoteSequenceTheme | null {
    return this.#selectedNoteSequenceTheme;
  }
}

customElements.define("note-sequence-selector", NoteSequenceSelector);
