package main

import (
	"net/http"
)

func getOrder(w http.ResponseWriter, r *http.Request) {
}

func fetchInventory() {
	http.Get("http://inventory-service/items")
}

func main() {
	http.HandleFunc("/orders", getOrder)
	http.ListenAndServe(":8080", nil)
}
