from __future__ import annotations

from .models import SourceSeed

SOURCE_SEEDS: list[SourceSeed] = [
    SourceSeed(
        title="Wildlife Protection Act resources",
        url="https://www.indiacode.nic.in/",
        category="policy",
        source="India",
        content_type="html",
        tags=["wildlife", "law", "india"],
        notes="Use India Code search pages to collect acts and amendments.",
    ),
    SourceSeed(
        title="MoEFCC notifications",
        url="https://moef.gov.in/",
        category="policy",
        source="India",
        content_type="html",
        tags=["policy", "notification", "conservation"],
    ),
    SourceSeed(
        title="National Biodiversity Authority",
        url="https://nbaindia.org/",
        category="species",
        source="India",
        content_type="html",
        tags=["species", "biodiversity"],
    ),
    SourceSeed(
        title="Forest Survey of India",
        url="https://fsi.nic.in/",
        category="ecosystems",
        source="India",
        content_type="html",
        tags=["forest", "ecosystem", "habitat"],
    ),
    SourceSeed(
        title="IUCN Red List",
        url="https://www.iucnredlist.org/",
        category="species",
        source="Global",
        content_type="html",
        tags=["endangered", "status"],
    ),
    SourceSeed(
        title="WWF biodiversity pages",
        url="https://www.worldwildlife.org/",
        category="ecosystems",
        source="Global",
        content_type="html",
        tags=["habitat", "conservation"],
    ),
    SourceSeed(
        title="UNEP environment resources",
        url="https://www.unep.org/",
        category="legal",
        source="Global",
        content_type="html",
        tags=["treaty", "regulation"],
    ),
    SourceSeed(
        title="Convention on Biological Diversity",
        url="https://www.cbd.int/",
        category="legal",
        source="Global",
        content_type="html",
        tags=["biodiversity", "treaty"],
    ),
]
