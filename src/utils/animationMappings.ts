export const animationMappings: Record<string, string[]> = {
  'happy': ['delight', 'joy', 'smile', 'laugh', 'excited'],
  'sad': [
    // High intensity (sad) - actual sadness/very sad/almost crying
    'depressed', 'sorrow', 'tear', 'gloom', 'worry', 'sobbing', 'devastated', 'heartbroken',
    // Low intensity (sad_02) - about to cry, watery eyes
    'teary', 'upset', 'emotional', 'misty', 'choked up'
  ],
  'angry': [
    // High intensity (angry_02)
    'furious', 'rage', 'shouting', 'yelling', 'livid', 'outraged', 'irate', 'mad',
    // Low intensity (angry_03)
    'stern', 'frown', 'serious', 'disapproving',
    // Medium intensity (angry)
    'annoyed', 'irritated', 'bothered', 'grumpy', 'frustrated'
  ],
  'surprise': ['shock', 'surprised', 'startle', 'gasp'],
  'shy': ['blush', 'embarrassed'],
  'no': ['frowning', 'disapproval', 'skeptical', 'indifferent', 'unimpressed'],
  'idle': ['stand', 'wait', 'default']
}
