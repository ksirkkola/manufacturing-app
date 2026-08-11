
/*
export interface StyleVariableMap {
    debug: string | null,
    backgroundColor: string | null
}
export const setStyleVariable = (variable: keyof StyleVariableMap, value: string | null = null) => {
*/

/**
 * Set or unset css variable
 * 
 * Can then be used in CSS as
 * 
 * ```css
 * .test { style: var(--name); }
 * ```
 */
export const setStyleVariable = (variable: string, value: string | null = null) => {
  const style = document.documentElement.style;
  const property = `--${variable}`;

  if (value === null) {
    style.removeProperty(property);
    return;
  }

  style.setProperty(property, value);
}