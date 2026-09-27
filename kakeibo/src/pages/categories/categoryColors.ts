/** カテゴリに選べる色。既定のカテゴリ（`src/db/seed.ts`）の色をすべて含む。 */
export const categoryColors: readonly { value: string; label: string }[] = [
  { value: '#e03131', label: '赤' },
  { value: '#d6336c', label: 'ピンク' },
  { value: '#ae3ec9', label: '赤紫' },
  { value: '#5f3dc4', label: '紫' },
  { value: '#1c7ed6', label: '青' },
  { value: '#1098ad', label: '水色' },
  { value: '#0ca678', label: '青緑' },
  { value: '#2f9e44', label: '緑' },
  { value: '#66a80f', label: '黄緑' },
  { value: '#74b816', label: 'ライム' },
  { value: '#f59f00', label: '黄' },
  { value: '#e8590c', label: 'オレンジ' },
  { value: '#868e96', label: '灰色' },
];

/** 追加するカテゴリの色の初期値。 */
export const defaultCategoryColor = '#868e96';
