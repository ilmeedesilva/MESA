package com.example.catalog;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CatalogApplication {
    @GetMapping("/products")
    public String products() {
        return "[]";
    }

    @PostMapping("/products")
    public String createProduct() {
        return "{}";
    }
}
