var assert = require("assert");
import TestSuite from "parsegraph-testsuite";
import Extent from "../dist/extent";

const extentTests = new TestSuite('Extent');

extentTests.addTest('Extent.simplify', function() {
  const extent = new Extent();
  extent.appendLS(10, 20);
  extent.appendLS(5, 20);
  extent.simplify();
  if (extent.numBounds() !== 1) {
    return 'Simplify must merge bounds with equal sizes.';
  }
});

extentTests.addTest('Extent.numBounds', function() {
  const extent = new Extent();
  if (extent.numBounds() !== 0) {
    return 'Extent must begin with an empty numBounds.';
  }
  extent.appendLS(1, 15);
  if (extent.numBounds() !== 1) {
    return 'Append must only add one bound.';
  }
  extent.appendLS(1, 20);
  extent.appendLS(1, 25);
  if (extent.numBounds() !== 3) {
    return 'Append must only add one bound per call.';
  }
});

extentTests.addTest('Extent.separation', function() {
  const forwardExtent = new Extent();
  const backwardExtent = new Extent();

  const testSeparation = function(expected) {
    return (
      forwardExtent.separation(backwardExtent) ==
        backwardExtent.separation(forwardExtent) &&
      forwardExtent.separation(backwardExtent) == expected
    );
  };

  forwardExtent.appendLS(50, 10);
  backwardExtent.appendLS(50, 10);
  if (!testSeparation(20)) {
    console.log(testSeparation(20));
    console.log(forwardExtent.separation(backwardExtent));
    console.log(backwardExtent.separation(forwardExtent));
    return (
      'For single bounds, separation should be equivalent to the size of the ' +
      'forward and backward extents.'
    );
  }

  backwardExtent.appendLS(50, 20);
  forwardExtent.appendLS(50, 20);
  if (!testSeparation(40)) {
    return false;
  }

  backwardExtent.appendLS(50, 20);
  forwardExtent.appendLS(50, 40);
  if (!testSeparation(60)) {
    return false;
  }

  backwardExtent.appendLS(50, 10);
  forwardExtent.appendLS(50, 10);
  if (!testSeparation(60)) {
    return false;
  }
});

extentTests.addTest(
    'Extent.Simple combinedExtent',
    function(resultDom) {
      const rootNode = new Extent();
      const forwardNode = new Extent();

      rootNode.appendLS(50, 25);
      forwardNode.appendLS(12, 6);
      const separation = rootNode.separation(forwardNode);

      const combined = rootNode.combinedExtent(forwardNode, 0, separation);

      const expected = new Extent();
      expected.appendLS(12, separation + 6);
      expected.appendLS(38, 25);

      if (!expected.equals(combined)) {
        resultDom.appendChild(expected.toDom('Expected forward extent'));
        resultDom.appendChild(combined.toDom('Actual forward extent'));
        return 'Combining extents does not work.';
      }
    },
);

extentTests.addTest('Extent.equals', function(
    resultDom,
) {
  const rootNode = new Extent();
  const forwardNode = new Extent();

  rootNode.appendLS(10, 10);
  rootNode.appendLS(10, NaN);
  rootNode.appendLS(10, 15);

  forwardNode.appendLS(10, 10);
  forwardNode.appendLS(10, NaN);
  forwardNode.appendLS(10, 15);

  if (!rootNode.equals(forwardNode)) {
    return 'Equals does not handle NaN well.';
  }
});

extentTests.addTest(
    'Extent.combinedExtent with NaN',
    function(resultDom) {
      const rootNode = new Extent();
      const forwardNode = new Extent();

      rootNode.appendLS(50, 25);

      forwardNode.appendLS(10, NaN);
      forwardNode.setBoundSizeAt(0, NaN);
      if (!isNaN(forwardNode.boundSizeAt(0))) {
        return forwardNode.boundSizeAt(0);
      }
      forwardNode.appendLS(30, 5);

      const separation = rootNode.separation(forwardNode);
      if (separation != 30) {
        return 'Separation doesn\'t even match. Actual=' + separation;
      }

      const combined = rootNode.combinedExtent(forwardNode, 0, separation);

      const expected = new Extent();
      expected.appendLS(10, 25);
      expected.appendLS(30, 35);
      expected.appendLS(10, 25);

      if (!expected.equals(combined)) {
        resultDom.appendChild(expected.toDom('Expected forward extent'));
        resultDom.appendChild(combined.toDom('Actual forward extent'));
        return 'Combining extents does not work.';
      }
    },
);

extentTests.addTest('Extent.combinedExtent', function(
    resultDom,
) {
  const rootNode = new Extent();
  const forwardNode = new Extent();

  rootNode.appendLS(50, 25);
  forwardNode.appendLS(12, 6);
  const separation = rootNode.separation(forwardNode);

  const combined = rootNode.combinedExtent(forwardNode, 25 - 6, separation);

  const expected = new Extent();
  expected.appendLS(19, 25);
  expected.appendLS(12, separation + 6);
  expected.appendLS(19, 25);

  if (!expected.equals(combined)) {
    resultDom.appendChild(expected.toDom('Expected forward extent'));
    resultDom.appendChild(combined.toDom('Actual forward extent'));
    return 'Combining extents does not work.';
  }
});

describe("Extent", function () {
  it("passes tests", ()=>{
    //assert.ok(extentTests.run((...args)=>{console.log(args)}).isSuccessful());
    assert.ok(extentTests.run().isSuccessful());
  });
});
