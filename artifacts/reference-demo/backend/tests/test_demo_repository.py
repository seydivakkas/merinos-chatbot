from merinos_agent.demo_repository import facets, match_faq, search_dealers, search_products


def test_product_filters_use_and_between_groups() -> None:
    result = search_products(query="Krem 160x230", colors=["Krem"], sizes=["160x230"], limit=10)
    assert result["total"] == 1
    assert result["items"][0]["name"] == "Elegance 90823"


def test_faq_match_requires_published_content() -> None:
    result = match_faq("Halı temizliği nasıl yapılır?")
    assert result["match"]["id"] == "cleaning"
    assert result["confidence"] in {"exact", "strong"}


def test_dealers_can_be_sorted_by_approximate_location() -> None:
    result = search_dealers(latitude=41.0, longitude=29.1, limit=2)
    assert len(result) == 2
    assert result[0]["approximateDistanceKm"] <= result[1]["approximateDistanceKm"]


def test_facets_are_derived_from_data() -> None:
    result = facets()
    assert "Salon Halısı" in result["categories"]
    assert "160x230" in result["sizes"]
