/**
 * A custom HTML element that allows users to select a musical note sequence theme.
 *
 * This component provides an interactive button that, when activated, displays
 * a modal dialog. Within this dialog, users can browse and select from a categorized
 * list of pre-defined musical note sequence themes (e.g., scales, arpeggios, modes).
 *
 * Key Features:
 * - **Interactive Display:** Renders a clickable button that shows the name
 * of the currently selected note sequence or a default prompt.
 * - **Modal Selection Dialog:** Presents an organized dialog with all available
 * note sequence themes, grouped by their category (e.g., "Scales", "Arpeggios").
 * - **Toggleable Information:** Allows users to reveal or hide detailed information
 * for each note sequence theme within the dialog.
 * - **Event-Driven Selection:** Dispatches a custom event ('note-sequence-selected')
 * when a user makes a selection, providing the theme's unique key and its full data object.
 * - **Programmatic Control:** Exposes public properties (`selectedNoteSequenceThemeKey`,
 * `selectedNoteSequenceTheme`) for direct JavaScript interaction.
 * - **Attribute Synchronization:** Supports setting the initial selected note sequence
 * via the `selected-note-sequence-theme-key` HTML attribute.
 * - **Random Selection:** Includes a public method to programmatically select a
 * random note sequence, useful for demonstrations or practice applications.
 *
 * @example
 * ```html
 * <note-sequence-selector selected-note-sequence-theme-key="ionian"></note-sequence-selector>
 * ```
 *
 * @example
 * ```css
 * <style>
 *   note-sequence-selector {
 *     --note-sequence-selector-padding: 0.8em 1.5em;
 *     border: 2px solid blue;
 *     border-radius: 5px;
 *   }
 * </style>
 * ```
 *
 * @module NoteSequenceSelector
 * @element note-sequence-selector
 * @fires NoteSequenceSelectedEvent
 * @attr {NoteSequenceThemeKey} selected-note-sequence-theme-key -
 * The unique key of the currently selected note sequence theme (e.g., "ionian", "dorian").
 * @cssprop {<length>} [--note-sequence-selector-padding=0] -
 * Controls the internal padding of the primary note selection button.
 * This defines the interactive area's size.
 * The padding property may be specified using one, two, three, or four values.
 * Each value is a <length> or a <percentage>. Negative values are invalid.
 */

import {
  allNoteSequenceThemes,
  type NoteSequenceTheme,
  type NoteSequenceThemeGroupKey,
  noteSequenceThemeGroupsMetadata,
  type NoteSequenceThemeKey,
  noteSequenceThemes,
} from "@musodojo/music-theory-data";

/**
 * HTML template for the `note-sequence-selector` custom element's Shadow DOM structure and styles.
 * @private
 * @type {HTMLTemplateElement}
 */
const noteSequenceSelectorTemplate = document.createElement("template");
noteSequenceSelectorTemplate.innerHTML = /* HTML */ `
  <style>
    :host {
      /* This custom property is used to pass user-defined padding from the light DOM
         into the Shadow DOM, specifically for the interactive button. */
      --_note-sequence-selector-padding: var(
        --note-sequence-selector-padding,
        0
      );

      display: inline-block;
      font-size: inherit;
    }

    /**
     * Base styles for all buttons within the component.
     * Ensures consistent font inheritance, removes default margins,
     * padding, background, and borders to allow for custom styling.
     */
    button {
      font: inherit;
      margin: 0;
      padding: 0;
      cursor: pointer;
      background: none;
      border: none;
    }

    /**
     * Styles for the primary button that opens the note sequence selection dialog.
     * It expands to fill the host's content area, with its internal padding
     * controlled by the --note-sequence-selector-padding custom property.
     */

    #note-sequence-selector-button {
      width: 100%;
      height: 100%;
      padding: var(--_note-sequence-selector-padding);
    }

    /**
     * Styles for the "close dialog" button within the modal.
     */
    #close-dialog-button {
      display: block;
      padding: 0.1em 0.5em;
      border: none;
      margin-inline-start: auto; /* Aligns button to the right */
    }

    /**
     * Styles for the native HTML <dialog> element.
     */
    dialog {
      padding: 0.5em;
    }

    /**
     * Styles for the dialog's backdrop (the overlay behind the modal).
     */
    dialog::backdrop {
      background: rgba(0, 0, 0, 0.5);
    }

    /**
     * Container for all note sequence groups within the dialog.
     * Uses flex box for vertical arrangement with a gap between groups.
     */
    #note-sequences-container {
      display: flex;
      flex-direction: column;
      gap: 1em;
      margin-block-start: 2em;
    }

    /**
     * Wrapper for each group of note sequences (e.g., "Diatonic Modes", "Dominant Variants").
     */
    #group-wrapper {
      > h3 {
        margin: 0em;
      }
    }

    /**
     * Wrapper for the individual note sequence options within each group.
     * Uses flex box for wrapping items with consistent spacing.
     */
    #group-note-sequences-wrapper {
      margin-block: 0.5em;
      display: flex;
      flex-wrap: wrap;
      gap: 1em;
    }

    /**
     * Styles for individual note sequence option buttons within the dialog.
     * Provides a clear visual boundary.
     */
    .note-sequence-option {
      padding: 0.5em;
      min-width: 4ch;
      max-width: 80ch;
      border: 0.1em solid currentColor;
      border-radius: 0.5em;
      cursor: pointer;
      text-align: left;
      text-wrap: pretty; /* Enable smart text wrapping if supported */

      > h4 {
        margin-block: 0.2em;
      }

      /* When the "more info" div is hidden, center the text */
      &:has(> .more-info-div.hidden) {
        text-align: center;
      }

      /* Styles for the "more info" content area within each option */
      > .more-info-div {
        display: flex;
        flex-direction: column;
        gap: 0.5em;
      }

      /* Hides the "more info" content when the 'hidden' class is present */
      > .more-info-div.hidden {
        display: none;
      }
    }

    /**
     * Styles for the checkbox label that toggles "more info" visibility.
     */
    #toggle-more-info-label {
      padding: 0.5em;
      border: 0.1em solid currentColor;
      border-radius: 0.5em;
      cursor: pointer;
    }

    /**
     * Utility class to hide elements.
     */
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

/**
 * Interface representing the detail payload for the 'note-sequence-selected' custom event.
 */
export interface NoteSequenceSelectedEventDetail {
  /**
   * The unique key of the selected note sequence theme (e.g., "ionian").
   * @type {NoteSequenceThemeKey}
   */
  noteSequenceThemeKey: NoteSequenceThemeKey;
  /**
   * The full {@link NoteSequenceTheme} object corresponding to the selected key.
   * @type {NoteSequenceTheme}
   */
  noteSequenceTheme: NoteSequenceTheme;
}

/**
 * Represents a custom HTML element for selecting a musical note sequence theme.
 *
 * @class NoteSequenceSelector
 * @extends HTMLElement
 * @property {NoteSequenceThemeKey | null} selectedNoteSequenceThemeKey - Gets or sets the unique key of the currently selected note sequence theme.
 * @property {NoteSequenceTheme | null} selectedNoteSequenceTheme - Gets the full data object for the currently selected note sequence theme. This property is read-only and derived from `selectedNoteSequenceThemeKey`.
 * @attr {string} selected-note-sequence-theme-key - The initial note sequence theme key to display when the component loads.
 */
export class NoteSequenceSelector extends HTMLElement {
  /**
   * The Shadow DOM root attached to this custom element.
   * @private
   * @type {ShadowRoot}
   */
  #shadowRoot: ShadowRoot;

  /**
   * Reference to the main button that triggers the dialog.
   * @private
   * @type {HTMLButtonElement | null}
   */
  #noteSequenceSelectorButton: HTMLButtonElement | null = null;

  /**
   * Reference to the modal dialog element that displays note sequence options.
   * @private
   * @type {HTMLDialogElement | null}
   */
  #noteSequenceSelectorDialog: HTMLDialogElement | null = null;

  /**
   * Reference to the container `div` within the dialog where note sequence groups are rendered.
   * @private
   * @type {HTMLDivElement | null}
   */
  #noteSequencesContainer: HTMLDivElement | null = null;

  /**
   * Reference to the checkbox that controls the visibility of "more info" sections.
   * @private
   * @type {HTMLInputElement | null}
   */
  #toggleMoreInfoCheckbox: HTMLInputElement | null = null;

  /**
   * AbortController instance used to manage and clean up event listeners efficiently.
   * @private
   * @type {AbortController | null}
   */
  #abortController: AbortController | null = null;

  /**
   * Stores the unique key of the currently selected note sequence theme.
   * @private
   * @type {NoteSequenceThemeKey | null}
   */
  #selectedNoteSequenceThemeKey: NoteSequenceThemeKey | null = null;

  /**
   * Stores the full data object for the currently selected note sequence theme.
   * @private
   * @type {NoteSequenceTheme | null}
   */
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
    // Only proceed if the attribute's value has actually changed
    if (oldValue === newValue) return;
    if (name === "selected-note-sequence-theme-key") {
      // Update the internal state with the new key
      this.selectedNoteSequenceThemeKey = newValue as
        | NoteSequenceThemeKey
        | null;
      // Dispatch the selection event to notify consumers of the change
      this.#dispatchNoteSequenceSelectedEvent();
    }
  }

  /**
   * Populates the dialog with dynamically created buttons for each note sequence theme,
   * organized by their respective groups.
   * @private
   */
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
            this.#noteSequenceSelectorDialog!.close();
          });

          groupNoteSequencesWrapper.appendChild(noteSequenceDiv);
        });

        this.#noteSequencesContainer!.appendChild(groupDiv);
      },
    );
  }

  /**
   * Renders the detailed "more info" content for a given note sequence theme.
   * @private
   * @param {NoteSequenceTheme} noteSequenceTheme - The note sequence theme data object.
   * @returns {string} An HTML string containing the detailed information.
   */
  #renderMoreInfo(noteSequenceTheme: NoteSequenceTheme): string {
    return /* HTML */ `
      <div>${noteSequenceTheme.names.join(", ")}</div>
      <div>${noteSequenceTheme.intervals.join(", ")}</div>
      <div>${noteSequenceTheme.type.join(", ")}</div>
      <div>${noteSequenceTheme.exampleNotes.join(", ")}</div>
      <div>${noteSequenceTheme.characteristics.join(", ")}</div>
      <div>${noteSequenceTheme.patternShort.join("-")}</div>
      <div>${noteSequenceTheme.pattern.join("-")}</div>
    `;
  }

  /**
   * Toggles the visibility of all "more info" sections within the element
   * based on the state of the `toggleMoreInfoCheckbox`.
   * @private
   */
  #updateMoreInfoVisibility() {
    const moreInfoElements = this.#shadowRoot?.querySelectorAll(
      ".more-info-div",
    ) as NodeListOf<HTMLDivElement>;
    moreInfoElements.forEach((el) => {
      el.classList.toggle("hidden", !this.#toggleMoreInfoCheckbox!.checked);
    });
  }

  /**
   * Updates the text content of the main note selector button to reflect
   * the `primaryName` of the currently selected note sequence theme, or a default text.
   * @private
   */
  #updateNoteSequenceSelectorButtonText() {
    this.#noteSequenceSelectorButton!.textContent = this
        .#selectedNoteSequenceTheme
      ? this.#selectedNoteSequenceTheme.primaryName
      : "Select Sequence";
  }

  /**
   * Synchronizes the `selected-note-sequence-theme-key` attribute on the host element
   * with the component's internal state.
   * @private
   */
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

  /**
   * Dispatches a custom event named 'note-sequence-selected' when a note sequence is chosen.
   * The event bubbles and composes, carrying the key and the full data object of the selected theme.
   * @private
   * @fires NoteSequenceSelectedEvent
   */
  #dispatchNoteSequenceSelectedEvent() {
    if (
      this.#selectedNoteSequenceThemeKey !== null &&
      this.#selectedNoteSequenceTheme !== null
    ) {
      this.dispatchEvent(
        new CustomEvent<NoteSequenceSelectedEventDetail>(
          "note-sequence-selected",
          {
            detail: {
              noteSequenceThemeKey: this.#selectedNoteSequenceThemeKey,
              noteSequenceTheme: this.#selectedNoteSequenceTheme,
            },
            bubbles: true,
            composed: true, // Allows the event to cross the Shadow DOM boundary
          },
        ),
      );
    } else {
      console.warn(
        "attempted to dispatch note-sequence-selected event with null data",
      );
    }
  }

  /**
   * Selects a random note sequence theme from all available themes and updates
   * the component's state and display.
   * This method programmatically sets the `selectedNoteSequenceThemeKey` property.
   * @public
   */
  setRandomNoteSequence() {
    const allNoteSequenceThemesKeys = Object.keys(allNoteSequenceThemes);
    const randomIndex = Math.floor(
      Math.random() * allNoteSequenceThemesKeys.length,
    );
    this.selectedNoteSequenceThemeKey = allNoteSequenceThemesKeys[
      randomIndex
    ] as NoteSequenceThemeKey;
  }

  /**
   * Gets the unique key of the currently selected note sequence theme.
   * @prop {NoteSequenceThemeKey | null} selectedNoteSequenceThemeKey
   * @returns {NoteSequenceThemeKey | null} The theme key (e.g., "ionian") or `null` if no theme is selected.
   */
  get selectedNoteSequenceThemeKey(): NoteSequenceThemeKey | null {
    return this.#selectedNoteSequenceThemeKey;
  }

  /**
   * Sets the currently selected note sequence theme by its unique key.
   * This will update the component's display and internal state. If a valid key
   * is provided, the corresponding `NoteSequenceTheme` object will be looked up
   * and stored internally. Setting to `null` clears the selection.
   * @param {NoteSequenceThemeKey | null} newNoteSequenceThemeKey - The unique key of the theme to select.
   * @prop {NoteSequenceThemeKey | null} selectedNoteSequenceThemeKey
   */
  set selectedNoteSequenceThemeKey(
    newNoteSequenceThemeKey: NoteSequenceThemeKey | null,
  ) {
    this.#selectedNoteSequenceThemeKey = newNoteSequenceThemeKey;
    // Look up the full theme object based on the key, or set to null if key is null
    this.#selectedNoteSequenceTheme = newNoteSequenceThemeKey
      ? allNoteSequenceThemes[newNoteSequenceThemeKey]
      : null;
    this.#updateNoteSequenceSelectorButtonText();
    this.#updateSelectedNoteSequenceAttribute();
    // No need to dispatch event here, as attributeChangedCallback will do it
  }

  /**
   * Gets the full data object for the currently selected note sequence theme.
   * This property is read-only and is derived from `selectedNoteSequenceThemeKey`.
   * @prop {NoteSequenceTheme | null} selectedNoteSequenceTheme
   * @returns {NoteSequenceTheme | null} The full theme object or `null` if no theme is selected.
   * @readonly
   */
  get selectedNoteSequenceTheme(): NoteSequenceTheme | null {
    return this.#selectedNoteSequenceTheme;
  }
}

/**
 * Defines the custom element 'note-sequence-selector' in the browser's CustomElementRegistry.
 * This makes the element available for use in HTML documents.
 */
customElements.define("note-sequence-selector", NoteSequenceSelector);
