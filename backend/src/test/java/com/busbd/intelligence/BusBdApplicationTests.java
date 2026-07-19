package com.busbd.intelligence;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
        "spring.data.redis.repositories.enabled=false",
        "busbd.demo-mode=true"
})
class BusBdApplicationTests {
    @Test
    void contextLoads() { }
}
