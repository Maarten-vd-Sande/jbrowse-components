// takes an array or Map or Set (anything iterable with values()) of Maps
// and lets you query them as one Map
export default class CompositeMap {
  constructor(submaps) {
    this.submaps = submaps
  }

  has(id) {
    for (const submap of this.submaps.values()) {
      if (submap.has(id)) return true
    }
    return false
  }

  get(id) {
    for (const submap of this.submaps.values()) {
      if (submap.has(id)) return submap.get(id)
    }
    return undefined
  }

  *values() {
    const submaps = Array.from(this.submaps.values())
    for (let i = 0; i < submaps.length; i += 1) {
      const submap = submaps[i]
      const values = Array.from(submap.values())
      for (let j = 0; j < values.length; j += 1) {
        yield values[j]
      }
    }

    // this is what the code should be, but it doesn't work
    // because of https://github.com/facebook/regenerator/issues/229
    // for (const submap of this.submaps.values())
    //   for (const value of submap.values())
    //      yield value
  }
}
