import { useId } from 'preact/hooks';
import { categoryColors } from './categoryColors.ts';

type Props = {
  /** 選ばれている色。`categoryColors` に無い色なら、どれも選ばれていない。 */
  value: string;
  onChange: (color: string) => void;
  /** 選択肢を囲む枠の見出し。 */
  legend: string;
};

/** カテゴリの色を `categoryColors` から1つ選ぶ。色ごとにラジオボタンを並べる。 */
export function ColorPicker({ value, onChange, legend }: Props) {
  const name = useId();
  return (
    <fieldset class="category-color-picker">
      <legend>{legend}</legend>
      <div class="category-color-options">
        {categoryColors.map((color) => (
          <label key={color.value} class="category-color-option" title={color.label}>
            <input
              type="radio"
              name={name}
              value={color.value}
              aria-label={color.label}
              checked={value.toLowerCase() === color.value}
              onChange={() => onChange(color.value)}
            />
            <span
              class="category-color-sample"
              style={{ backgroundColor: color.value }}
              aria-hidden="true"
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
