package main

func router() {
	// gin-style route registration
	r.GET("/catalogue", listCatalogue)
	r.GET("/tags", listTags)
}
