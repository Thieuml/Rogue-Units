/**
 * Translate state keys to plain language
 * e.g. landings.door.locks => Landing Doors Lock
 */

export function translateStateKey(stateKey: string): string {
  if (!stateKey) return stateKey
  
  // Split by dots and capitalize each word
  const parts = stateKey.split('.')
  
  const translated = parts.map(part => {
    // Handle common abbreviations and special cases
    const specialCases: Record<string, string> = {
      'door': 'Door',
      'doors': 'Doors',
      'lock': 'Lock',
      'locks': 'Locks',
      'landing': 'Landing',
      'landings': 'Landings',
      'car': 'Car',
      'frame': 'Frame',
      'guide': 'Guide',
      'shoes': 'Shoes',
      'guideShoes': 'Guide Shoes',
      'remoteAlarm': 'Remote Alarm',
      'motor': 'Motor',
      'controller': 'Controller',
      'cable': 'Cable',
      'cables': 'Cables',
      'pulley': 'Pulley',
      'pulleys': 'Pulleys',
      'brake': 'Brake',
      'brakes': 'Brakes',
      'safety': 'Safety',
      'switch': 'Switch',
      'switches': 'Switches',
      'sensor': 'Sensor',
      'sensors': 'Sensors',
      'button': 'Button',
      'buttons': 'Buttons',
      'display': 'Display',
      'light': 'Light',
      'lights': 'Lights',
      'fan': 'Fan',
      'fans': 'Fans',
      'ventilation': 'Ventilation',
      'emergency': 'Emergency',
      'phone': 'Phone',
      'intercom': 'Intercom',
      'shaft': 'Shaft',
      'pit': 'Pit',
      'machine': 'Machine',
      'room': 'Room',
      'hoistway': 'Hoistway',
      'elevator': 'Elevator',
      'lift': 'Lift',
    }
    
    // Check if it's a special case
    if (specialCases[part]) {
      return specialCases[part]
    }
    
    // Otherwise, capitalize first letter and handle camelCase
    if (part.match(/[A-Z]/)) {
      // CamelCase - split and capitalize
      return part
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    }
    
    // Regular word - capitalize first letter
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  })
  
  return translated.join(' ')
}

