import getTimeInMillis from 'parsegraph-gettimeinmillis';
import fuzzyEquals from 'parsegraph-fuzzyequals';

const DEFAULT_EXTENT_BOUNDS = 1;
const NUM_EXTENT_BOUND_COMPONENTS = 2;
const SEPARATION_TIMEOUT_MS = 10000;
/* eslint-disable require-jsdoc, max-len  */

export default function Extent(copy) {
  if (copy !== undefined && copy._bounds) {
    this._offset = copy._offset;
    this._numBounds = copy._numBounds;
    this._bounds = new Float32Array(copy._bounds);
    this._start = copy._start;
    if (copy._minSize !== null) {
      this._minSize = copy._minSize;
      this._maxSize = copy._maxSize;
      this._totalLength = copy._totalLength;
    }
  } else {
    this._start = 0;
    this._offset = 0;
    this._numBounds = 0;
    this._bounds = null;
    this._minSize = null;
    this._maxSize = null;
    this._totalLength = null;
  }
}

Extent.prototype.setOffset = function(offset) {
  this._offset = offset;
};

Extent.prototype.offset = function() {
  return this._offset;
};

Extent.prototype.forEach = function(func, thisArg) {
  if (arguments.length === 1 || thisArg === undefined) {
    thisArg = this;
  }
  for (let i = 0; i < this._numBounds; ++i) {
    func.call(thisArg, this.boundLengthAt(i), this.boundSizeAt(i), i);
  }
};

Extent.prototype.clone = function() {
  return new Extent(this);
};

Extent.prototype.clear = function() {
  this._numBounds = 0;
  this.invalidateBoundingValues();
};

Extent.prototype.numBounds = function() {
  return this._numBounds;
};

Extent.prototype.hasBounds = function() {
  return this.numBounds() > 0;
};

Extent.prototype.boundLengthAt = function(index) {
  return this._bounds[
      NUM_EXTENT_BOUND_COMPONENTS *
      ((this._start + index) % this.boundCapacity())
  ];
};

Extent.prototype.boundSizeAt = function(index) {
  return this._bounds[
      NUM_EXTENT_BOUND_COMPONENTS *
      ((this._start + index) % this.boundCapacity()) +
      1
  ];
};

Extent.prototype.invalidateBoundingValues = function() {
  this._minSize = null;
  this._maxSize = null;
  this._totalLength = null;
};

Extent.prototype.setBoundLengthAt = function(index, length) {
  this._bounds[
      NUM_EXTENT_BOUND_COMPONENTS *
      ((this._start + index) % this.boundCapacity())
  ] = length;
  this.invalidateBoundingValues();
};

Extent.prototype.setBoundSizeAt = function(index, size) {
  this._bounds[
      NUM_EXTENT_BOUND_COMPONENTS *
      ((this._start + index) % this.boundCapacity()) +
      1
  ] = size;
  this.invalidateBoundingValues();
};

Extent.prototype.realloc = function(capacity) {
  if (capacity < DEFAULT_EXTENT_BOUNDS) {
    capacity = DEFAULT_EXTENT_BOUNDS;
  }
  const oldBounds = this._bounds;
  const oldCap = this.boundCapacity();
  if (oldCap >= capacity) {
    // TODO This could shrink.
    throw new Error('Cannot shrink Extent capacity');
  }

  // Change the capacity.
  this._bounds = new Float32Array(
      NUM_EXTENT_BOUND_COMPONENTS * capacity,
  );

  if (oldBounds) {
    if (this._start + this._numBounds > oldCap) {
      const frontBounds = this._start + this._numBounds - oldCap;
      // TODO See if this can be copied more efficiently, and if that matters.
      for (
        let i = 0;
        i <
        NUM_EXTENT_BOUND_COMPONENTS *
          (this._numBounds - frontBounds);
        ++i
      ) {
        this._bounds[i] = oldBounds[this._start + i];
      }
      for (
        let i = 0;
        i <
        NUM_EXTENT_BOUND_COMPONENTS *
          (this._numBounds - frontBounds);
        ++i
      ) {
        this._bounds[this._numBounds - frontBounds + i] = oldBounds[i];
      }
    } else {
      // Can do it in a single copy.
      for (
        let i = 0;
        i < NUM_EXTENT_BOUND_COMPONENTS * this._numBounds;
        ++i
      ) {
        this._bounds[i] = oldBounds[this._start + i];
      }
    }
    // console.log(oldBounds, "to", this._bounds);
  }

  this._start = 0;

  return 0;
};

Extent.prototype.prependLS = function(length, size) {
  if (isNaN(length)) {
    throw new Error('Length must not be NaN');
  }
  if (length == 0) {
    // Drop empty lengths.
    return;
  }
  // Do not allow negative length values.
  if (length < 0) {
    const str =
      'Non-positive bound lengths are not allowed, but ' +
      length +
      ' was given anyway.';
    throw new Error(str);
  }

  if (this.numBounds() > 0) {
    const frontSize = this.boundSizeAt(0);
    if ((Number.isNaN(frontSize) && Number.isNaN(size)) || frontSize === size) {
      // Extent the first bound.
      this.setBoundLengthAt(0, this.boundLengthAt(0) + length);
      return;
    }
  }

  if (this.boundCapacity() == this.numBounds()) {
    // Completely full, so expand.
    let newCap = DEFAULT_EXTENT_BOUNDS;
    if (this.boundCapacity() > 0) {
      newCap = 2 * this.boundCapacity();
    }
    this.realloc(newCap);
  }

  if (this._start == 0) {
    this._start = this.boundCapacity() - 1;
  } else {
    --this._start;
  }

  ++this._numBounds;
  this.setBoundLengthAt(0, length);
  this.setBoundSizeAt(0, size);
};

Extent.prototype.boundCapacity = function() {
  if (!this._bounds) {
    return 0;
  }
  return this._bounds.length / NUM_EXTENT_BOUND_COMPONENTS;
};

Extent.prototype.appendLS = function(length, size) {
  if (isNaN(length)) {
    throw new Error('Length must not be NaN');
  }
  if (length === 0) {
    // Drop empty lengths.
    return;
  }
  if (length < 0) {
    const str =
      'Non-positive bound lengths are not allowed, but ' +
      length +
      ' was given anyway.';
    throw new Error(str);
  }

  if (this.numBounds() > 0) {
    const lastSize = this.boundSizeAt(this.numBounds() - 1);
    if ((isNaN(lastSize) && isNaN(size)) || lastSize === size) {
      this.setBoundLengthAt(
          this.numBounds() - 1,
          this.boundLengthAt(this.numBounds() - 1) + length,
      );
      return;
    }
  }

  if (this.boundCapacity() == this.numBounds()) {
    // Completely full, so expand.
    let newCap = DEFAULT_EXTENT_BOUNDS;
    if (this.boundCapacity() > 0) {
      newCap = 2 * this.boundCapacity();
    }
    this.realloc(newCap);
  }

  ++this._numBounds;
  this.setBoundLengthAt(this.numBounds() - 1, length);
  this.setBoundSizeAt(this.numBounds() - 1, size);
};

Extent.prototype.prependSL = function(size, length) {
  this.prependLS(length, size);
};

Extent.prototype.appendSL = function(size, length) {
  this.appendLS(length, size);
};

Extent.prototype.adjustSize = function(adjustment) {
  // Adjust the size of each bound.
  for (let i = 0; i < this.numBounds(); ++i) {
    const size = this.boundSizeAt(i);
    // Ignore empty sizes.
    if (!isNaN(size)) {
      this.setBoundSizeAt(i, size + adjustment);
    }
  }
};

Extent.prototype.simplify = function() {
  let totalLength = 0;
  let maxSize = NaN;
  for (let i = 0; i < this.numBounds(); ++i) {
    totalLength += this.boundLengthAt(i);

    const size = this.boundSizeAt(i);
    if (isNaN(maxSize)) {
      maxSize = size;
    } else if (!isNaN(size)) {
      maxSize = Math.max(maxSize, size);
    }
  }
  this.clear();
  this.appendLS(totalLength, maxSize);
};

Extent.prototype.sizeAt = function(offset) {
  // Do not allow negative offsets.
  if (offset < 0) {
    throw createException(OFFSET_IS_NEGATIVE);
  }

  // Determine the bound at the given offset.
  let pos = 0;
  let i = 0;
  while (i < this.numBounds()) {
    const thisBoundLength = this.boundLengthAt(i);
    if (offset <= pos + thisBoundLength) {
      break;
    }
    pos += thisBoundLength;
    ++i;
  }
  // Return NaN if the offset is beyond the full size of this extent.
  if (i == this.numBounds()) {
    return NaN;
  }

  // Return the size at the determined bound.
  return this.boundSizeAt(i);
};

Extent.prototype.combineBound = function(
    newBoundStart,
    newBoundLength,
    newBoundSize,
) {
  // Create the extent to be merged.
  const added = new Extent();
  added.appendLS(newBoundLength, newBoundSize);

  // Copy the combined result into this extent.
  this.copyFrom(this.combinedExtent(added, newBoundStart));
};

Extent.prototype.copyFrom = function(from) {
  this._numBounds = from._numBounds;
  this._bounds = from._bounds;
  from.clear();
  this.invalidateBoundingValues();
};

Extent.prototype.combineExtentAndSimplify = function(
    given,
    lengthAdjustment,
    sizeAdjustment,
    scale,
    bv,
) {
  if (!bv) {
    bv = [null, null, null];
  }
  given.boundingValues(bv);
  const givenLength = bv[0];
  const givenMaxSize = bv[2];
  this.boundingValues(bv);
  const thisLength = bv[0];
  const thisMaxSize = bv[2];
  this.clear();
  let combinedLength;
  if (lengthAdjustment < 0) {
    combinedLength = Math.max(
        thisLength - lengthAdjustment,
        givenLength * scale,
    );
  } else {
    combinedLength = Math.max(
        thisLength,
        givenLength * scale + lengthAdjustment,
    );
  }
  this.appendLS(
      combinedLength,
      Math.max(thisMaxSize, givenMaxSize * scale + sizeAdjustment),
  );
};

Extent.prototype.combineExtent = function(
    given,
    lengthAdjustment,
    sizeAdjustment,
    scale,
) {
  // Combine the extent into this one, creating a new extent in the process.
  const result = this.combinedExtent(
      given,
      lengthAdjustment,
      sizeAdjustment,
      scale,
  );

  // Copy the combined result into this extent.
  this.copyFrom(result);
};

Extent.prototype.combinedExtent = function(
    given,
    lengthAdjustment,
    sizeAdjustment,
    scale,
) {
  if (lengthAdjustment === undefined) {
    lengthAdjustment = 0;
  }
  if (sizeAdjustment === undefined) {
    sizeAdjustment = 0;
  }
  if (scale === undefined) {
    scale = 1.0;
  }
  if (lengthAdjustment < 0) {
    const result = given.combinedExtent(
        this,
        -lengthAdjustment / scale,
        -sizeAdjustment / scale,
        1 / scale,
    );
    result.scale(scale);
    result.adjustSize(sizeAdjustment);
    return result;
  } else if (lengthAdjustment > 0) {
    // We have a length adjustment.
    const givenCopy = given.clone();
    givenCopy.prependLS(lengthAdjustment / scale, NaN);
    return this.combinedExtent(givenCopy, 0, sizeAdjustment, scale);
  }

  let thisBound = 0;
  let thisPosition = 0;
  let givenBound = 0;
  let givenPosition = 0;

  // Returns this bound's size
  const getThisSize = function() {
    if (thisBound >= this.numBounds()) {
      throw new Error(
          'Getting this bound\'s size past the ' + 'end of this extent.',
      );
    }
    return this.boundSizeAt(thisBound);
  };

  // Returns given's bound's size
  const getGivenSize = function() {
    if (givenBound >= given.numBounds()) {
      throw new Error(
          'Getting given\'s size past the end of ' + 'given\'s extent.',
      );
    }
    const rv = given.boundSizeAt(givenBound);
    if (isNaN(rv)) {
      return NaN;
    }
    return scale * rv + sizeAdjustment;
  };

  // Moves to this extent's next bound. true is returned as long as
  // thisBound is valid.
  const getThisNextBound = function() {
    if (thisBound >= this.numBounds()) {
      throw new Error('Getting past end of this extent.');
    }
    thisPosition += this.boundLengthAt(thisBound);
    ++thisBound;
    return thisBound != this.numBounds();
  };

  // Increments given's iterator. true is returned as long as givenBound
  // is valid.
  const getGivenNextBound = function() {
    if (givenBound >= given.numBounds()) {
      throw new Error('Getting past end of given bound.');
    }
    givenPosition += scale * given.boundLengthAt(givenBound);
    ++givenBound;
    return givenBound != given.numBounds();
  };

  const givenReach = function() {
    if (givenBound >= given.numBounds()) {
      return givenPosition;
    }
    return givenPosition + scale * given.boundLengthAt(givenBound);
  };

  const thisReach = function() {
    if (thisBound == this.numBounds()) {
      return thisPosition;
    }
    return thisPosition + this.boundLengthAt(thisBound);
  };

  // Create the aggregate result.
  const result = new Extent();

  // Iterate over each bound.
  // let combinedIteration = 0;
  while (givenBound != given.numBounds() && thisBound != this.numBounds()) {
    // console.log("Iterating over each bound.");
    // console.log("This reach: " + thisReach.call(this) + ", size: " + getThisSize.call(this) + ", pos: " + thisPosition);
    // console.log("Given reach: " + givenReach.call(this) + ", size: " + getGivenSize.call(this) + ", pos: " + givenPosition);
    // ++combinedIteration;
    const thisSize = getThisSize.call(this);
    const givenSize = getGivenSize.call(this);

    let newSize;
    if (!isNaN(thisSize) && !isNaN(givenSize)) {
      newSize = Math.max(thisSize, givenSize);
    } else if (!isNaN(thisSize)) {
      newSize = thisSize;
    } else {
      newSize = givenSize;
    }

    result.appendLS(
        Math.min(thisReach.call(this), givenReach.call(this)) -
        Math.max(thisPosition, givenPosition),
        newSize,
    );

    if (thisReach.call(this) == givenReach.call(this)) {
      // This bound ends at the same position as given's
      // bound, so increment both iterators.
      getThisNextBound.call(this);
      getGivenNextBound.call(this);
    } else if (thisReach.call(this) < givenReach()) {
      // This bound ends before given's bound, so increment
      // this bound's iterator.
      getThisNextBound.call(this);
    } else {
      // Assert: thisReach() > givenReach()
      // Given's bound ends before this bound, so increment
      // given's iterator.
      getGivenNextBound.call(this);
    }
  }

  if (givenBound != given.numBounds()) {
    // Finish off given last overlapping bound to get completely
    // in sync with givens.
    result.appendLS(
        givenReach.call(this) - thisReach.call(this),
        getGivenSize.call(this),
    );
    while (getGivenNextBound.call(this)) {
      // ++combinedIteration;
      result.appendLS(
          scale * given.boundLengthAt(givenBound),
          getGivenSize.call(this),
      );
    }
  } else if (thisBound != this.numBounds()) {
    // Finish off this extent's last overlapping bound to get completely
    // in sync with given's iterator.
    result.appendLS(
        thisReach.call(this) - givenReach.call(this),
        getThisSize.call(this),
    );
    while (getThisNextBound.call(this)) {
      // ++combinedIteration;
      result.appendLS(this.boundLengthAt(thisBound), getThisSize.call(this));
    }
  }
  // console.log("Combined after " + combinedIteration + "iterations");
  return result;
};

Extent.prototype.scale = function(factor) {
  this.forEach(function(length, size, i) {
    this.setBoundLengthAt(i, length * factor);
    if (!isNaN(this.boundSizeAt(i))) {
      this.setBoundSizeAt(i, size * factor);
    }
  }, this);
};

class ExtentSeparator {
  constructor(thisExtent, givenExtent, positionAdjustment, allowAxisOverlap, givenScale) {
    this._thisExtent = thisExtent;
    this._givenExtent = givenExtent;
    this._thisBound = 0;
    this._givenBound = 0;

    this._thisPosition = 0;

    this._positionAdjustment = positionAdjustment;
    this._allowAxisOverlap = allowAxisOverlap;
    this._givenScale = givenScale;

    // The position of given. This is in this node's space.
    this._givenPosition = 0;
  }

  /*
   * Moves the iterator for this extent to its next bound.
   *
   * The iterator is just a fancy counter. Both the position
   * and the bound index are tracked.
   */
  incrementThisBound() {
    this._thisPosition += this._thisExtent.boundLengthAt(this._thisBound);
    ++this._thisBound;
  };

  givenBoundLength() {
    return this._givenScale * this._givenExtent.boundLengthAt(this._givenBound);
  };

  givenBoundSize() {
    const rv = this._givenExtent.boundSizeAt(this._givenBound);
    if (isNaN(rv)) {
      return rv;
    }
    return this._givenScale * rv;
  };

  thisBoundSize() {
    return this._thisExtent.boundSizeAt(this._thisBound);
  };

  /*
   * Moves the iterator for the given extent to the next bound.
   *
   * The iterator is just a fancy counter. Both the position
   * and the bound index are tracked.
   */
  incrementGivenBound() {
    this._givenPosition += this.givenBoundLength();
    ++this._givenBound;
  };

  givenAtEnd() {
    return this._givenBound == this._givenExtent.numBounds();
  };

  thisAtEnd() {
    return this._thisBound == this._thisExtent.numBounds();
  };

  consume(extentSeparation, axisMinimum) {
    // While the iterators still have bounds in both extents.
    while (!this.givenAtEnd() && !this.thisAtEnd()) {
      // Calculate the separation between these bounds.
      // console.log("Separating");
      // console.log("This bound size: " + this.boundSizeAt(this._thisBound));
      // console.log("Given bound size: " + this.givenBoundSize());
      const thisSize = this._thisExtent.boundSizeAt(this._thisBound);
      const givenSize = this.givenBoundSize();
      let boundSeparation;
      if (!isNaN(thisSize) && !isNaN(givenSize)) {
        boundSeparation = thisSize + givenSize;
      } else if (!this._allowAxisOverlap) {
        if (!isNaN(thisSize)) {
          boundSeparation = thisSize + axisMinimum;
        } else if (!isNaN(givenSize)) {
          boundSeparation = givenSize + axisMinimum;
        } else {
          // Both extents are empty at this location.
          boundSeparation = 0;
        }
      } else {
        // Axis overlap is allowed.
        boundSeparation = 0;
      }
      if (boundSeparation > extentSeparation) {
        extentSeparation = boundSeparation;
        // console.log("Found new separation of " + extentSeparation + ".");
      }

      // Increment the iterators to the next testing point.

      // endComparison is a difference that indicates which bound
      // ends soonest.
      const endComparison =
        this._thisPosition +
        this._thisExtent.boundLengthAt(this._thisBound) -
        this._positionAdjustment -
        (this._givenPosition + this._givenScale * this._givenExtent.boundLengthAt(this._givenBound));

      if (endComparison == 0) {
        // This bound ends at the same position as given's bound,
        // so increment both.

        this.incrementGivenBound();
        this.incrementThisBound();
      } else if (endComparison > 0) {
        // This bound ends after given's bound, so increment the
        // given bound's iterator.
        this.incrementGivenBound();
      }
      if (endComparison < 0) {
        // Given's bound ends after this bound, so increment this
        // bound's iterator.
        this.incrementThisBound();
      }
    }
    return extentSeparation;
  }
};

Extent.prototype.separation = function(
    given,
    positionAdjustment,
    allowAxisOverlap,
    givenScale,
    axisMinimum,
) {
  if (positionAdjustment === undefined) {
    positionAdjustment = 0;
  }
  if (allowAxisOverlap === undefined) {
    allowAxisOverlap = true;
  }
  if (axisMinimum === undefined) {
    axisMinimum = 0;
  }
  if (givenScale === undefined) {
    givenScale = 1.0;
  }
  // console.log("Separation(positionAdjustment=" + positionAdjustment + ")");

  const separator = new ExtentSeparator(this, given, positionAdjustment, allowAxisOverlap, givenScale);

  // extentSeparation is the minimum distance to separate this extent
  // from the given extent, so that they do not overlap if facing one
  // another.
  let extentSeparation = 0;

  // Adjust this extent's iterator to account for the position adjustment.
  if (positionAdjustment < 0) {
    while (
      !separator.givenAtEnd() &&
      separator._givenPosition + separator.givenBoundLength() <= -positionAdjustment
    ) {
      // If we don't allow axis overlap, then be sure to include these bounds
      // that are being skipped.
      const boundSeparation = separator.givenBoundSize();
      if (
        !allowAxisOverlap &&
        !isNaN(boundSeparation) &&
        boundSeparation > extentSeparation
      ) {
        extentSeparation = boundSeparation + axisMinimum;
      }
      separator.incrementGivenBound();
    }
  } else {
    // Positive positionAdjustment.
    while (
      !separator.thisAtEnd() &&
      separator._thisPosition + this.boundLengthAt(separator._thisBound) <= positionAdjustment
    ) {
      const boundSeparation = separator.thisBoundSize();
      if (
        !allowAxisOverlap &&
        !isNaN(boundSeparation) &&
        boundSeparation > extentSeparation
      ) {
        extentSeparation = boundSeparation;
      }
      separator.incrementThisBound();
    }
  }

  extentSeparation = separator.consume(extentSeparation, axisMinimum)

  if (!allowAxisOverlap) {
    // Calculate the separation between the remaining bounds of given and
    // the separation boundary.
    const startTime = getTimeInMillis();
    while (!separator.givenAtEnd()) {
      if (getTimeInMillis() - startTime > SEPARATION_TIMEOUT_MS) {
        throw new Error('Extent separation timed out');
      }

      const givenSize = given.boundSizeAt(separator._givenBound);
      if (!isNaN(givenSize)) {
        extentSeparation = Math.max(
            extentSeparation,
            givenScale * givenSize + axisMinimum,
        );
      }
      ++separator._givenBound;
    }
  }

  return extentSeparation;
};

Extent.prototype.boundingValues = function(outVal) {
  if (!outVal) {
    outVal = [null, null, null];
  }
  if (this._minSize !== null) {
    outVal[0] = this._totalLength;
    outVal[1] = this._minSize;
    outVal[2] = this._maxSize;
    return outVal;
  }
  let totalLength = 0;
  let minSize = NaN;
  let maxSize = NaN;

  for (let iter = 0; iter != this.numBounds(); ++iter) {
    totalLength += this.boundLengthAt(iter);

    const size = this.boundSizeAt(iter);
    if (isNaN(minSize)) {
      minSize = size;
    } else if (!isNaN(size)) {
      minSize = Math.min(minSize, size);
    }

    if (isNaN(maxSize)) {
      maxSize = size;
    } else if (!isNaN(size)) {
      maxSize = Math.max(maxSize, size);
    }
  }

  outVal[0] = totalLength;
  outVal[1] = minSize;
  outVal[2] = maxSize;
  this._minSize = minSize;
  this._maxSize = maxSize;
  this._totalLength = totalLength;
  return outVal;
};

Extent.prototype.equals = function(other, fuzziness) {
  // Exit quickly if we are comparing with ourselves.
  if (this === other) {
    return true;
  }

  // Ensure the sizes match.
  if (!other || this.numBounds() != other.numBounds()) {
    return false;
  }

  // Compare the bounds for equality.
  for (let i = 0; i < this.numBounds(); ++i) {
    if (
      !fuzzyEquals(
          this.boundLengthAt(i),
          other.boundLengthAt(i)
      )
    ) {
      return false;
    }
    const thisSize = this.boundSizeAt(i);
    const otherSize = other.boundSizeAt(i);
    if (isNaN(thisSize) && isNaN(otherSize)) {
      // Both NaN.
      continue;
    }
    // Fail if one is NaN and the other is not.
    if (isNaN(thisSize) || isNaN(otherSize)) {
      return false;
    }
    if (
      !fuzzyEquals(
          this.boundSizeAt(i),
          other.boundSizeAt(i)
      )
    ) {
      return false;
    }
  }
  return true;
};

Extent.prototype.dump = function(message) {
  if (message !== undefined) {
    log(message);
  }

  let offset = 0;
  for (let i = 0; i < this.numBounds(); ++i) {
    log(
        '' +
        offset +
        ': [length=' +
        this.boundLengthAt(i) +
        ', size=' +
        this.boundSizeAt(i) +
        ']',
    );
    offset += this.boundLengthAt(i);
  }
};

Extent.prototype.toDom = function(message) {
  const rv = document.createElement('table');
  rv.className = 'Extent';

  if (message !== undefined) {
    const titleRow = document.createElement('tr');
    rv.appendChild(titleRow);
    titleRow.appendChild(document.createElement('th'));
    titleRow.lastChild.innerHTML = message;
    titleRow.lastChild.colSpan = 3;
  }

  const headerRow = document.createElement('tr');
  rv.appendChild(headerRow);
  headerRow.appendChild(document.createElement('th'));
  headerRow.lastChild.innerHTML = 'Offset';
  headerRow.appendChild(document.createElement('th'));
  headerRow.lastChild.innerHTML = 'Length';
  headerRow.appendChild(document.createElement('th'));
  headerRow.lastChild.innerHTML = 'Size';

  let offset = 0;
  for (let i = 0; i < this.numBounds(); ++i) {
    const boundRow = document.createElement('tr');
    rv.appendChild(boundRow);

    boundRow.appendChild(document.createElement('td'));
    boundRow.lastChild.innerHTML = offset;

    boundRow.appendChild(document.createElement('td'));
    boundRow.lastChild.innerHTML = this.boundLengthAt(i);

    boundRow.appendChild(document.createElement('td'));
    boundRow.lastChild.innerHTML = this.boundSizeAt(i);

    offset += this.boundLengthAt(i);
  }

  return rv;
};

export function createExtent(copy) {
  return new Extent(copy);
}

export function checkExtentsEqual(
    caret,
    direction,
    expected,
    resultDom,
) {
  if (caret.node().extentsAt(direction).equals(expected)) {
    return true;
  }
  if (resultDom) {
    resultDom.appendChild(
        expected.toDom(
            'Expected ' + nameNodeDirection(direction) + ' extent',
        ),
    );
    resultDom.appendChild(
        caret
            .node()
            .extentsAt(direction)
            .toDom('Actual ' + nameNodeDirection(direction) + ' extent'),
    );
    resultDom.appendChild(
        document.createTextNode(
            'Extent offset = ' + caret.node().extentOffsetAt(direction),
        ),
    );
  }
  return false;
}
