# AI Baseline Comparison

Provider: anthropic | Runs per system: 5

| System | Benchmark | F1 mean | F1 stdev | Precision mean | Recall mean | Exact-match rate | Mean pairwise Jaccard |
|---|---|---:|---:|---:|---:|---:|---:|
| Spring Boot microservices sample (piomin/sample-spring-microservices-new) | `/Users/ilmeedesilva/MESA/benchmarks/real_repo_spring_sample.yml` | 0.0 | 0.0 | 0.0 | 0.0 | 0.4 | 0.5333 |
| God Service | `/Users/ilmeedesilva/MESA/benchmarks/ground_truth.yml` | 0.3438 | 0.0277 | 0.6667 | 0.2353 | 0.4 | 0.7533 |
| Cyclic dependencies | `/Users/ilmeedesilva/MESA/benchmarks/ground_truth.yml` | 0.4 | 0.0 | 0.5 | 0.3333 | 1.0 | 1.0 |
