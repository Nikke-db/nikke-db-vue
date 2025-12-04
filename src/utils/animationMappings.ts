export const animationMappings: Record<string, string[]> = {
  'happy': [
    'delight', 'joy', 'smile', 'laugh', 'excited', 'glee', 'grin', 'chuckle', 'giggle', 'smirk', 
    'beam', 'radiant', 'happy', 'content', 'pleased', 'amused', 'cheerful', 'triumph'
  ],
  'cry': [
    'cry', 'crying', 'weep', 'tears',
  ],
  'sad': [
    // High intensity (sad) - actual sadness/very sad/almost crying
    'depressed', 'sorrow', 'tear', 'gloom', 'worry', 'sobbing', 'devastated', 'heartbroken', 
    'hurt', 'pain', 'agony', 'grief', 'mourn', 'sad', 'unhappy', 'melancholy', 
    'despair', 'hopeless', 'anguish', 'misery',
    // Low intensity (sad_02) - about to cry, watery eyes
    'teary', 'upset', 'emotional', 'misty', 'choked up', 'pout', 'whine'
  ],
  'angry': [
    // High intensity (angry_02)
    'furious', 'rage', 'shouting', 'yelling', 'livid', 'outraged', 'irate', 'mad', 'fury', 
    'anger', 'seethe', 'hiss', 'growl', 'snap', 'bitter', 'resent', 'hate', 'loathe', 'vengeful',
    // Low intensity (angry_03)
    'stern', 'frown', 'serious', 'disapproving', 'scowl', 'glare', 'cross',
    // Medium intensity (angry)
    'annoyed', 'irritated', 'bothered', 'grumpy', 'frustrated', 'groan', 'disgust'
  ],
  'surprise': ['shock', 'surprised', 'startle', 'gasp', 'wide-eyed', 'blink', 'stunned', 'amazed', 'astonished', 'aback', 'confused', 'puzzled'],
  'shy': ['blush', 'embarrassed', 'shy', 'bashful', 'timid', 'stutter', 'stammer', 'fluster', 'nervous', 'anxious'],
  'no': ['frowning', 'disapproval', 'skeptical', 'indifferent', 'unimpressed', 'shake head', 'deny', 'refuse', 'reject', 'doubt', 'sigh'],
  'idle': ['stand', 'wait', 'default', 'calm', 'neutral']
}
