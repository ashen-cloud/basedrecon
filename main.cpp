#include <nlohmann/detail/exceptions.hpp>
#include <nlohmann/json.hpp> // from aur
#include <iostream>
#include <fstream>
#include <filesystem>
#include <ratio>
#include <stdio.h>
#include <chrono>
#include <thread>

namespace fs = std::filesystem;

using json = nlohmann::json;

#define APP_NAME "basedrecon"

std::string create_cache_dir() {
  std::string home_path = getenv("HOME");
  std::string cache_path = home_path + "/.cache/" + APP_NAME;

  std::cout << "Checking cache dir at " << cache_path << std::endl;

  fs::create_directories(cache_path);

  return cache_path + "/";
}

void cli() {
  std::cout << std::endl;
  std::cout << "cli started, typing 'help' works" << std::endl;

  while (true) {
    std::string cmd;

    std::cout << ">";

    std::getline(std::cin, cmd);

    if (std::cin.eof()) { // ctrl-d
      return;
    }

    std::istringstream iss {cmd};

    // split string cmd by spaces
    std::vector<std::string> cmd_split = {std::istream_iterator<std::string>{iss}, std::istream_iterator<std::string>{}};

        std::this_thread::sleep_for(std::chrono::milliseconds(200));
  }
}

int main(int argc, char** argv) {

  std::string cache_path = create_cache_dir();

  std::string hosts_path = cache_path + "/" + "hosts";

  fs::path f_path{ hosts_path };
  if (!fs::exists(f_path)) {
    std::ofstream({ hosts_path }); // open+close the stream to create the file
  }

  cli();

  // std::ifstream hosts{hosts_path};

  // try {
    // json hosts_data = json::parse(hosts);

    // std::cout << hosts_data.size() << std::endl;;

    // std::cout << argv[1] << std::endl;
  // } catch(nlohmann::detail::parse_error) { // empty file or broken json err
//     
  // }

}
