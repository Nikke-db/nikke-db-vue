export const animationMappings: Record<string, string[]> = {
  'happy': ['delight', 'joy', 'smile', 'laugh', 'excited'],
  'sad': ['cry', 'depressed', 'sorrow', 'tear', 'gloom', 'worry'],
  'angry': [
    // High intensity (angry_02)
    'furious', 'rage', 'shouting', 'yelling', 'livid', 'outraged', 'irate', 'mad',
    // Low intensity (angry_03)
    'stern', 'frown', 'serious', 'disapproving',
    // Base/Other
    'annoyed', 'irritated', 'bothered', 'grumpy', 'frustrated'
  ],
  'surprise': ['shock', 'surprised', 'startle', 'gasp'],
  'shy': ['blush', 'embarrassed'],
  'no': ['frowning', 'disapproval', 'skeptical', 'indifferent', 'unimpressed'],
  'idle': ['stand', 'wait', 'default']
}
