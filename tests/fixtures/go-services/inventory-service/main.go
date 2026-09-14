package main

import (
	"google.golang.org/grpc"
)

func syncOrders() {
	grpc.Dial("orders-service:9090")
}

func router() {
	// gin-style route registration
	r.GET("/items", listItems)
}
