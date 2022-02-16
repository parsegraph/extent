# parsegraph-extent

This module provides a class to manage separation between graphs. It is intended
to be used in a set, with one extent managing a specific axis and direction. Methods
are provided to calculate the minimum distance needed to separate two extents, as well
as methods to combine two extents into a single extent that covers both.

    import Extent from 'parsegraph-extent'

    const rootNode = new Extent();
    const forwardNode = new Extent();

    rootNode.appendLS(50, 25);
    forwardNode.appendLS(12, 6);
    const separation = rootNode.separation(forwardNode);

    const combined = rootNode.combinedExtent(forwardNode, 0, separation);

    const expected = new Extent();
    expected.appendLS(12, separation + 6);
    expected.appendLS(38, 25);

    assert.ok(expected.equals(combined), "Combining extents does not work.");

